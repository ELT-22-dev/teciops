import type { ConferenceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";
import { applyStockMovement } from "../rolls/rolls.service";

export async function lookupRollByCode(companyId: string, code: string) {
  const roll = await prisma.roll.findFirst({ where: { companyId, code }, include: { article: true } });
  if (!roll) throw AppError.notFound(`Rolo com etiqueta "${code}"`);
  return roll;
}

export async function listConferences(companyId: string, pagination: Pagination, status?: ConferenceStatus) {
  const where: Prisma.ConferenceWhereInput = { companyId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.conference.findMany({
      where,
      include: { roll: { include: { article: true } }, user: true },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(pagination)
    }),
    prisma.conference.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function createConference(companyId: string, userId: string, rollId: string, countedMeters: number) {
  const roll = await prisma.roll.findFirst({ where: { id: rollId, companyId } });
  if (!roll) throw AppError.notFound("Rolo");

  const systemMeters = Number(roll.balanceMeters);
  const difference = Number((countedMeters - systemMeters).toFixed(2));
  const status: ConferenceStatus = difference === 0 ? "CONFIRMED" : "DIVERGENT";

  return prisma.conference.create({
    data: {
      companyId,
      rollId,
      userId,
      systemMeters,
      countedMeters,
      difference,
      status,
      resolvedAt: status === "CONFIRMED" ? new Date() : null
    },
    include: { roll: { include: { article: true } } }
  });
}

export async function resolveConference(companyId: string, id: string, userId: string, applyAdjustment: boolean) {
  const conference = await prisma.conference.findFirst({ where: { id, companyId } });
  if (!conference) throw AppError.notFound("Conferencia");
  if (conference.status === "CONFIRMED" && conference.resolvedAt) {
    return conference;
  }

  return prisma.$transaction(async (tx) => {
    if (applyAdjustment) {
      await applyStockMovement(tx, {
        companyId,
        rollId: conference.rollId,
        type: "ADJUSTMENT",
        meters: Number(conference.countedMeters),
        reason: `Ajuste por conferencia ${conference.id}`,
        userId
      });
    }

    return tx.conference.update({
      where: { id },
      data: { status: "CONFIRMED", resolvedAt: new Date() }
    });
  });
}

export async function pendingQueue(companyId: string) {
  return prisma.conference.findMany({
    where: { companyId, status: { in: ["PENDING", "DIVERGENT"] } },
    include: { roll: { include: { article: true } } },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}
