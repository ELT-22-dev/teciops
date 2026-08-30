import type { Prisma, RollStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { nextSequenceCode } from "../../utils/sequence";

type Tx = Prisma.TransactionClient;

export function computeAutoStatus(
  currentStatus: RollStatus,
  balance: number,
  initial: number,
  criticalBelow: number
): RollStatus {
  if (currentStatus === "RESERVED") return "RESERVED";
  if (balance <= criticalBelow) return "CRITICAL";
  if (initial > 0 && balance < initial * 0.3) return "REMNANT";
  return "WHOLE";
}

/**
 * Aplica uma movimentacao de estoque a um rolo dentro de uma transacao, recalculando
 * o saldo e o status automatico do rolo. Usado por pedidos/PDV (OUT), recebimento de
 * lote de importacao (IN) e conferencia do deposito (ADJUSTMENT).
 */
export async function applyStockMovement(
  tx: Tx,
  params: {
    companyId: string;
    rollId: string;
    type: StockMovementType;
    meters: number; // sempre positivo; a direcao e definida pelo "type"
    reason?: string;
    orderId?: string;
    userId?: string;
  }
) {
  const roll = await tx.roll.findFirst({ where: { id: params.rollId, companyId: params.companyId } });
  if (!roll) throw AppError.notFound("Rolo");

  const previousBalance = Number(roll.balanceMeters);
  let movementMeters = params.meters;

  if (params.type === "OUT") {
    // Update condicional e atomico: so decrementa se o saldo no momento da escrita ainda
    // for suficiente. Isso evita saldo negativo quando dois pedidos cortam o mesmo rolo
    // ao mesmo tempo (a linha fica bloqueada durante o UPDATE no Postgres).
    const result = await tx.roll.updateMany({
      where: { id: roll.id, companyId: params.companyId, balanceMeters: { gte: params.meters } },
      data: { balanceMeters: { decrement: params.meters } }
    });
    if (result.count === 0) {
      const fresh = await tx.roll.findUniqueOrThrow({ where: { id: roll.id } });
      throw new AppError(
        `Saldo insuficiente no rolo ${roll.code}: disponivel ${fresh.balanceMeters}m, solicitado ${params.meters}m.`,
        409
      );
    }
  } else if (params.type === "IN") {
    await tx.roll.update({ where: { id: roll.id }, data: { balanceMeters: { increment: params.meters } } });
  } else {
    // ADJUSTMENT: params.meters e o novo saldo contado (absoluto)
    await tx.roll.update({ where: { id: roll.id }, data: { balanceMeters: params.meters } });
    movementMeters = Math.abs(params.meters - previousBalance);
  }

  const refreshed = await tx.roll.findUniqueOrThrow({ where: { id: roll.id } });
  const status = computeAutoStatus(roll.status, Number(refreshed.balanceMeters), Number(roll.initialMeters), Number(roll.criticalBelowMeters));

  const updatedRoll = await tx.roll.update({
    where: { id: roll.id },
    data: { status }
  });

  await tx.stockMovement.create({
    data: {
      companyId: params.companyId,
      rollId: roll.id,
      type: params.type,
      meters: movementMeters,
      reason: params.reason,
      orderId: params.orderId,
      userId: params.userId
    }
  });

  return updatedRoll;
}

export async function listRolls(
  companyId: string,
  pagination: Pagination,
  filters: { search?: string; status?: RollStatus; warehouse?: string; articleId?: string }
) {
  const where: Prisma.RollWhereInput = {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.warehouse ? { warehouse: filters.warehouse } : {}),
    ...(filters.articleId ? { articleId: filters.articleId } : {}),
    ...(filters.search
      ? {
          OR: [
            { code: { contains: filters.search, mode: "insensitive" } },
            { color: { contains: filters.search, mode: "insensitive" } },
            { article: { name: { contains: filters.search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.roll.findMany({
      where,
      include: { article: true },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(pagination)
    }),
    prisma.roll.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getRoll(companyId: string, id: string) {
  const roll = await prisma.roll.findFirst({
    where: { id, companyId },
    include: {
      article: true,
      importLot: true,
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { order: { include: { customer: true } } }
      }
    }
  });
  if (!roll) throw AppError.notFound("Rolo");
  return roll;
}

export async function createRoll(
  companyId: string,
  data: {
    articleId: string;
    color: string;
    initialMeters: number;
    weightKg?: number;
    warehouse: string;
    location?: string;
    landedCost?: number;
    importLotId?: string;
    criticalBelowMeters?: number;
  }
) {
  const article = await prisma.article.findFirst({ where: { id: data.articleId, companyId } });
  if (!article) throw AppError.notFound("Artigo");

  return prisma.$transaction(async (tx) => {
    const code = await nextSequenceCode(tx, "roll", companyId, "R-", 4300);
    const roll = await tx.roll.create({
      data: {
        companyId,
        code,
        articleId: data.articleId,
        color: data.color,
        initialMeters: data.initialMeters,
        balanceMeters: data.initialMeters,
        weightKg: data.weightKg,
        warehouse: data.warehouse,
        location: data.location,
        landedCost: data.landedCost,
        importLotId: data.importLotId,
        criticalBelowMeters: data.criticalBelowMeters ?? 5,
        status: "WHOLE"
      }
    });

    await tx.stockMovement.create({
      data: {
        companyId,
        rollId: roll.id,
        type: "IN",
        meters: data.initialMeters,
        reason: "Entrada manual de rolo"
      }
    });

    return roll;
  });
}

export async function updateRoll(
  companyId: string,
  id: string,
  data: Partial<{
    color: string;
    warehouse: string;
    location: string;
    status: RollStatus;
    landedCost: number;
    criticalBelowMeters: number;
  }>
) {
  const existing = await prisma.roll.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Rolo");
  return prisma.roll.update({ where: { id }, data });
}

export async function adjustRoll(companyId: string, id: string, countedMeters: number, reason: string | undefined, userId: string) {
  const existing = await prisma.roll.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Rolo");

  return prisma.$transaction((tx) =>
    applyStockMovement(tx, {
      companyId,
      rollId: id,
      type: "ADJUSTMENT",
      meters: countedMeters,
      reason: reason ?? "Ajuste manual de saldo",
      userId
    })
  );
}
