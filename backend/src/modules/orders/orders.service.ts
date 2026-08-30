import type { OrderStage, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { nextSequenceCode } from "../../utils/sequence";
import { applyStockMovement } from "../rolls/rolls.service";

type Tx = Prisma.TransactionClient;

interface OrderItemInput {
  articleId: string;
  rollId?: string;
  color: string;
  meters: number;
  unitPrice: number;
}

interface CreateOrderInput {
  customerId: string;
  channel: "COUNTER" | "WHOLESALE";
  paymentMethod: PaymentMethod;
  items: OrderItemInput[];
  discount: number;
  immediateCut: boolean;
  dueDate?: Date;
  notes?: string;
}

async function resolveRollForItem(tx: Tx, companyId: string, item: OrderItemInput) {
  if (item.rollId) {
    const roll = await tx.roll.findFirst({ where: { id: item.rollId, companyId } });
    if (!roll) throw AppError.notFound(`Rolo ${item.rollId}`);
    if (Number(roll.balanceMeters) < item.meters) {
      throw new AppError(`Saldo insuficiente no rolo ${roll.code}: disponivel ${roll.balanceMeters}m, solicitado ${item.meters}m.`, 409);
    }
    return roll;
  }

  const candidate = await tx.roll.findFirst({
    where: {
      companyId,
      articleId: item.articleId,
      color: item.color,
      balanceMeters: { gte: item.meters }
    },
    orderBy: { createdAt: "asc" }
  });

  if (!candidate) {
    throw new AppError(
      `Nao ha rolo com saldo suficiente para o artigo/cor informado (${item.meters}m solicitados).`,
      409
    );
  }

  return candidate;
}

export async function createOrder(companyId: string, sellerId: string, input: CreateOrderInput) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
  if (!customer) throw AppError.notFound("Cliente");

  const itemsTotal = input.items.reduce((sum, item) => sum + item.meters * item.unitPrice, 0);
  const totalValue = Math.max(0, itemsTotal - input.discount);
  const totalMeters = input.items.reduce((sum, item) => sum + item.meters, 0);

  if (input.paymentMethod === "TERM" || input.paymentMethod === "BOLETO") {
    const openTitles = await prisma.financialTitle.aggregate({
      where: { customerId: customer.id, status: { in: ["OPEN", "OVERDUE"] } },
      _sum: { value: true }
    });
    const openBalance = Number(openTitles._sum.value ?? 0);
    const availableCredit = Number(customer.creditLimit) - openBalance;
    if (totalValue > availableCredit) {
      throw AppError.conflict(
        `Limite de credito insuficiente. Disponivel: R$ ${availableCredit.toFixed(2)}, pedido: R$ ${totalValue.toFixed(2)}.`
      );
    }
  }

  const stage: OrderStage = input.channel === "COUNTER" && input.immediateCut ? "CUT" : "AWAITING_CUT";

  return prisma.$transaction(async (tx) => {
    const code = await nextSequenceCode(tx, "order", companyId, "PED-", 2400);

    const order = await tx.order.create({
      data: {
        companyId,
        code,
        customerId: input.customerId,
        sellerId,
        channel: input.channel,
        stage,
        paymentMethod: input.paymentMethod,
        totalMeters,
        discount: input.discount,
        totalValue,
        notes: input.notes
      }
    });

    for (const item of input.items) {
      const roll = stage === "CUT" || input.channel === "COUNTER" ? await resolveRollForItem(tx, companyId, item) : null;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          articleId: item.articleId,
          rollId: roll?.id ?? item.rollId,
          color: item.color,
          meters: item.meters,
          unitPrice: item.unitPrice,
          totalPrice: item.meters * item.unitPrice
        }
      });

      if (roll && stage === "CUT") {
        await applyStockMovement(tx, {
          companyId,
          rollId: roll.id,
          type: "OUT",
          meters: item.meters,
          reason: `Corte para pedido ${code}`,
          orderId: order.id,
          userId: sellerId
        });
      }
    }

    if (input.paymentMethod === "TERM" || input.paymentMethod === "BOLETO") {
      const titleCode = await nextSequenceCode(tx, "financialTitle", companyId, "TIT-", 1100);
      const defaultDueDays = input.paymentMethod === "TERM" ? 15 : 30;
      await tx.financialTitle.create({
        data: {
          companyId,
          code: titleCode,
          customerId: input.customerId,
          orderId: order.id,
          value: totalValue,
          dueDate: input.dueDate ?? new Date(Date.now() + defaultDueDays * 86_400_000),
          paymentMethod: input.paymentMethod,
          status: "OPEN",
          isCaderneta: input.paymentMethod === "TERM" && input.channel === "COUNTER"
        }
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: { include: { article: true, roll: true } }, customer: true, seller: true }
    });
  });
}

export async function listOrders(
  companyId: string,
  pagination: Pagination,
  filters: { stage?: OrderStage; customerId?: string; search?: string }
) {
  const where: Prisma.OrderWhereInput = {
    companyId,
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.search
      ? {
          OR: [
            { code: { contains: filters.search, mode: "insensitive" } },
            { customer: { name: { contains: filters.search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, seller: true, items: true },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(pagination)
    }),
    prisma.order.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getOrder(companyId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      seller: true,
      items: { include: { article: true, roll: true } },
      financialTitles: true,
      fiscalNotes: true
    }
  });
  if (!order) throw AppError.notFound("Pedido");
  return order;
}

const ALLOWED_TRANSITIONS: Record<OrderStage, OrderStage[]> = {
  QUOTE: ["AWAITING_CUT", "CUT", "CANCELLED"],
  AWAITING_CUT: ["CUT", "CANCELLED"],
  CUT: ["INVOICED", "CANCELLED"],
  INVOICED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: []
};

export async function advanceOrderStage(companyId: string, id: string, sellerId: string, nextStage: OrderStage) {
  const order = await prisma.order.findFirst({ where: { id, companyId }, include: { items: true } });
  if (!order) throw AppError.notFound("Pedido");

  if (!ALLOWED_TRANSITIONS[order.stage].includes(nextStage)) {
    throw AppError.conflict(`Nao e possivel mover o pedido de ${order.stage} para ${nextStage}.`);
  }

  if (nextStage === "CANCELLED") {
    return cancelOrder(companyId, id, sellerId);
  }

  if (nextStage === "CUT" && order.stage !== "CUT") {
    return prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        let rollId = item.rollId;

        if (!rollId) {
          const roll = await resolveRollForItem(tx, companyId, {
            articleId: item.articleId,
            color: item.color,
            meters: Number(item.meters),
            unitPrice: Number(item.unitPrice)
          });
          rollId = roll.id;
          await tx.orderItem.update({ where: { id: item.id }, data: { rollId } });
        }

        await applyStockMovement(tx, {
          companyId,
          rollId,
          type: "OUT",
          meters: Number(item.meters),
          reason: `Corte para pedido ${order.code}`,
          orderId: order.id,
          userId: sellerId
        });
      }
      return tx.order.update({ where: { id }, data: { stage: nextStage }, include: { items: true, customer: true } });
    });
  }

  return prisma.order.update({ where: { id }, data: { stage: nextStage }, include: { items: true, customer: true } });
}

export async function cancelOrder(companyId: string, id: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id, companyId }, include: { items: true } });
  if (!order) throw AppError.notFound("Pedido");
  if (order.stage === "CANCELLED") return order;

  return prisma.$transaction(async (tx) => {
    if (order.stage === "CUT" || order.stage === "INVOICED") {
      for (const item of order.items) {
        if (item.rollId) {
          await applyStockMovement(tx, {
            companyId,
            rollId: item.rollId,
            type: "IN",
            meters: Number(item.meters),
            reason: `Estorno do pedido cancelado ${order.code}`,
            orderId: order.id,
            userId
          });
        }
      }
    }

    await tx.financialTitle.updateMany({
      where: { orderId: order.id, status: { in: ["OPEN", "OVERDUE"] } },
      data: { status: "CANCELLED" }
    });

    return tx.order.update({ where: { id }, data: { stage: "CANCELLED" }, include: { items: true, customer: true } });
  });
}

export async function getOrderKpis(companyId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthOrders, awaitingCut, cutMeters, totalValueAgg] = await Promise.all([
    prisma.order.count({ where: { companyId, createdAt: { gte: startOfMonth }, stage: { not: "CANCELLED" } } }),
    prisma.order.count({ where: { companyId, stage: "AWAITING_CUT" } }),
    prisma.order.aggregate({
      where: { companyId, createdAt: { gte: startOfMonth }, stage: { not: "CANCELLED" } },
      _sum: { totalMeters: true }
    }),
    prisma.order.aggregate({
      where: { companyId, createdAt: { gte: startOfMonth }, stage: { not: "CANCELLED" } },
      _sum: { totalValue: true }
    })
  ]);

  return {
    ordersThisMonth: monthOrders,
    awaitingCut,
    metersThisMonth: cutMeters._sum.totalMeters ?? 0,
    valueThisMonth: totalValueAgg._sum.totalValue ?? 0
  };
}
