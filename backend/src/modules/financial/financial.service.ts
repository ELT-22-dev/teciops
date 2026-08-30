import type { Prisma, TitleStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { nextSequenceCode } from "../../utils/sequence";
import { buildWhatsAppLink } from "../../utils/whatsapp";

/** Marca como OVERDUE qualquer titulo OPEN cujo vencimento ja passou. Chamado antes de listagens/relatorios. */
export async function syncOverdueTitles(companyId: string) {
  await prisma.financialTitle.updateMany({
    where: { companyId, status: "OPEN", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" }
  });
}

export async function listTitles(
  companyId: string,
  pagination: Pagination,
  filters: { status?: TitleStatus; customerId?: string; isCaderneta?: boolean }
) {
  await syncOverdueTitles(companyId);

  const where: Prisma.FinancialTitleWhereInput = {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.isCaderneta !== undefined ? { isCaderneta: filters.isCaderneta } : {})
  };

  const [items, total] = await Promise.all([
    prisma.financialTitle.findMany({
      where,
      include: { customer: true, order: true },
      orderBy: { dueDate: "asc" },
      ...toSkipTake(pagination)
    }),
    prisma.financialTitle.count({ where })
  ]);

  const withWhatsApp = items.map((title) => ({
    ...title,
    whatsappLink: buildWhatsAppLink(
      title.customer.phone,
      `Ola ${title.customer.name}, o titulo ${title.code} no valor de R$ ${Number(title.value).toFixed(2)} venceu em ${title.dueDate.toLocaleDateString("pt-BR")}. Pode acertar hoje?`
    )
  }));

  return buildPageResult(withWhatsApp, total, pagination);
}

export async function getAging(companyId: string) {
  await syncOverdueTitles(companyId);

  const openTitles = await prisma.financialTitle.findMany({
    where: { companyId, status: { in: ["OPEN", "OVERDUE"] } }
  });

  const buckets = {
    naoVencido: 0,
    d1a30: 0,
    d31a60: 0,
    d61a90: 0,
    d90mais: 0
  };

  const now = Date.now();
  for (const title of openTitles) {
    const daysOverdue = Math.floor((now - title.dueDate.getTime()) / 86_400_000);
    const value = Number(title.value);
    if (daysOverdue <= 0) buckets.naoVencido += value;
    else if (daysOverdue <= 30) buckets.d1a30 += value;
    else if (daysOverdue <= 60) buckets.d31a60 += value;
    else if (daysOverdue <= 90) buckets.d61a90 += value;
    else buckets.d90mais += value;
  }

  const totalOpen = Object.values(buckets).reduce((a, b) => a + b, 0);
  const totalOverdue = buckets.d1a30 + buckets.d31a60 + buckets.d61a90 + buckets.d90mais;

  return { buckets, totalOpen, totalOverdue, openTitlesCount: openTitles.length };
}

export async function createCaderneta(
  companyId: string,
  data: { customerId: string; value: number; dueDate?: Date; notes?: string }
) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId } });
  if (!customer) throw AppError.notFound("Cliente");

  return prisma.$transaction(async (tx) => {
    const code = await nextSequenceCode(tx, "financialTitle", companyId, "TIT-", 1100);
    return tx.financialTitle.create({
      data: {
        companyId,
        code,
        customerId: data.customerId,
        value: data.value,
        dueDate: data.dueDate ?? new Date(Date.now() + 15 * 86_400_000),
        paymentMethod: "TERM",
        status: "OPEN",
        isCaderneta: true
      },
      include: { customer: true }
    });
  });
}

export async function payTitle(companyId: string, id: string, paidAt?: Date) {
  const title = await prisma.financialTitle.findFirst({ where: { id, companyId } });
  if (!title) throw AppError.notFound("Titulo");
  if (title.status === "PAID") throw AppError.conflict("Este titulo ja esta pago.");
  if (title.status === "CANCELLED") throw AppError.conflict("Este titulo foi cancelado.");

  return prisma.financialTitle.update({
    where: { id },
    data: { status: "PAID", paidAt: paidAt ?? new Date() }
  });
}

export async function chargeTitle(companyId: string, id: string) {
  const title = await prisma.financialTitle.findFirst({ where: { id, companyId }, include: { customer: true } });
  if (!title) throw AppError.notFound("Titulo");

  const whatsappLink = buildWhatsAppLink(
    title.customer.phone,
    `Ola ${title.customer.name}, o titulo ${title.code} no valor de R$ ${Number(title.value).toFixed(2)} venceu em ${title.dueDate.toLocaleDateString("pt-BR")}. Pode acertar hoje via Pix?`
  );

  if (!whatsappLink) {
    throw AppError.conflict("Este cliente nao tem telefone cadastrado para cobranca via WhatsApp.");
  }

  await prisma.financialTitle.update({ where: { id }, data: { lastChargedAt: new Date() } });

  return { whatsappLink };
}
