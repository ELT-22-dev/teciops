import type { ImportLotStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { nextSequenceCode } from "../../utils/sequence";

export async function listImportLots(companyId: string, pagination: Pagination, status?: ImportLotStatus) {
  const where: Prisma.ImportLotWhereInput = { companyId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.importLot.findMany({
      where,
      include: { supplier: true },
      orderBy: { eta: "asc" },
      ...toSkipTake(pagination)
    }),
    prisma.importLot.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getImportLot(companyId: string, id: string) {
  const lot = await prisma.importLot.findFirst({
    where: { id, companyId },
    include: { supplier: true, rolls: { include: { article: true } } }
  });
  if (!lot) throw AppError.notFound("Lote de importacao");
  return lot;
}

function costPerMeter(fobUsd: number, exchangeRate: number, meters: number) {
  return meters > 0 ? (fobUsd * exchangeRate) / meters : 0;
}

export async function createImportLot(
  companyId: string,
  data: {
    supplierId: string;
    articlesDesc: string;
    country?: string;
    container?: string;
    meters: number;
    fobUsd: number;
    exchangeRate: number;
    eta: Date;
  }
) {
  const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } });
  if (!supplier) throw AppError.notFound("Fornecedor");

  return prisma.$transaction(async (tx) => {
    const code = await nextSequenceCode(tx, "importLot", companyId, "LT-", 2600);
    return tx.importLot.create({
      data: {
        companyId,
        code,
        supplierId: data.supplierId,
        articlesDesc: data.articlesDesc,
        country: data.country,
        container: data.container,
        meters: data.meters,
        fobUsd: data.fobUsd,
        exchangeRate: data.exchangeRate,
        costPerMeter: costPerMeter(data.fobUsd, data.exchangeRate, data.meters),
        eta: data.eta,
        status: "BOOKED"
      }
    });
  });
}

export async function updateImportLot(
  companyId: string,
  id: string,
  data: Partial<{
    articlesDesc: string;
    country: string;
    container: string;
    meters: number;
    fobUsd: number;
    exchangeRate: number;
    eta: Date;
    status: ImportLotStatus;
  }>
) {
  const existing = await prisma.importLot.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Lote de importacao");

  const meters = data.meters ?? Number(existing.meters);
  const fobUsd = data.fobUsd ?? Number(existing.fobUsd);
  const exchangeRate = data.exchangeRate ?? Number(existing.exchangeRate);

  return prisma.importLot.update({
    where: { id },
    data: { ...data, costPerMeter: costPerMeter(fobUsd, exchangeRate, meters) }
  });
}

export async function receiveImportLot(
  companyId: string,
  id: string,
  rollsInput: Array<{ articleId: string; color: string; meters: number; weightKg?: number; warehouse: string; location?: string }>
) {
  const lot = await prisma.importLot.findFirst({ where: { id, companyId } });
  if (!lot) throw AppError.notFound("Lote de importacao");
  if (lot.status === "ARRIVED") throw AppError.conflict("Este lote ja foi recebido.");

  return prisma.$transaction(async (tx) => {
    const createdRolls = [];
    for (const rollInput of rollsInput) {
      const article = await tx.article.findFirst({ where: { id: rollInput.articleId, companyId } });
      if (!article) throw AppError.notFound(`Artigo ${rollInput.articleId}`);

      const code = await nextSequenceCode(tx, "roll", companyId, "R-", 4300);
      const roll = await tx.roll.create({
        data: {
          companyId,
          code,
          articleId: rollInput.articleId,
          color: rollInput.color,
          initialMeters: rollInput.meters,
          balanceMeters: rollInput.meters,
          weightKg: rollInput.weightKg,
          warehouse: rollInput.warehouse,
          location: rollInput.location,
          landedCost: lot.costPerMeter,
          importLotId: lot.id,
          status: "WHOLE"
        }
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          rollId: roll.id,
          type: "IN",
          meters: rollInput.meters,
          reason: `Entrada do lote ${lot.code}`
        }
      });

      createdRolls.push(roll);
    }

    const updatedLot = await tx.importLot.update({
      where: { id: lot.id },
      data: { status: "ARRIVED", receivedAt: new Date() }
    });

    return { lot: updatedLot, rolls: createdRolls };
  });
}
