import type { FiscalNoteStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { nextSequenceCode } from "../../utils/sequence";
import { getFiscalProvider } from "./fiscal.provider";

export async function listFiscalNotes(companyId: string, pagination: Pagination, status?: FiscalNoteStatus) {
  const where: Prisma.FiscalNoteWhereInput = { companyId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.fiscalNote.findMany({
      where,
      include: { order: { include: { customer: true } } },
      orderBy: { issuedAt: "desc" },
      ...toSkipTake(pagination)
    }),
    prisma.fiscalNote.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getFiscalNote(companyId: string, id: string) {
  const note = await prisma.fiscalNote.findFirst({ where: { id, companyId }, include: { order: { include: { customer: true } } } });
  if (!note) throw AppError.notFound("Nota fiscal");
  return note;
}

export async function issueFiscalNote(companyId: string, orderId: string, cfop: string, icmsRate: number) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId }, include: { customer: true } });
  if (!order) throw AppError.notFound("Pedido");
  if (order.stage === "CANCELLED") throw AppError.conflict("Nao e possivel emitir NF-e para um pedido cancelado.");

  const existing = await prisma.fiscalNote.findFirst({
    where: { orderId, companyId, status: { in: ["AUTHORIZED", "PENDING"] } }
  });
  if (existing) throw AppError.conflict(`Ja existe a nota fiscal ${existing.number} para este pedido.`);

  const value = Number(order.totalValue);
  const icms = Number((value * (icmsRate / 100)).toFixed(2));

  const provider = getFiscalProvider();
  const result = await provider.issue({
    orderCode: order.code,
    customerName: order.customer.name,
    customerCnpj: order.customer.cnpj,
    cfop,
    value,
    icms
  });

  return prisma.$transaction(async (tx) => {
    const number = await nextSequenceCode(tx, "fiscalNote", companyId, "NFE-", 1000);

    const note = await tx.fiscalNote.create({
      data: {
        companyId,
        number,
        orderId,
        cfop,
        value,
        icms,
        status: result.status,
        sefazProtocol: result.sefazProtocol,
        accessKey: result.accessKey,
        rejectionReason: result.rejectionReason
      }
    });

    if (result.status === "AUTHORIZED") {
      await tx.order.update({ where: { id: orderId }, data: { stage: "INVOICED" } });
    }

    return note;
  });
}

export async function cancelFiscalNote(companyId: string, id: string) {
  const note = await prisma.fiscalNote.findFirst({ where: { id, companyId } });
  if (!note) throw AppError.notFound("Nota fiscal");
  if (note.status !== "AUTHORIZED") throw AppError.conflict("Apenas notas autorizadas podem ser canceladas.");

  const provider = getFiscalProvider();
  if (note.accessKey) {
    await provider.cancel(note.accessKey);
  }

  return prisma.fiscalNote.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
}
