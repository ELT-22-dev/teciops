import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";

export async function listSuppliers(companyId: string, pagination: Pagination, search?: string) {
  const where = {
    companyId,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: { name: "asc" }, ...toSkipTake(pagination) }),
    prisma.supplier.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getSupplier(companyId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId },
    include: { importLots: { orderBy: { eta: "desc" }, take: 10 } }
  });
  if (!supplier) throw AppError.notFound("Fornecedor");
  return supplier;
}

export async function createSupplier(
  companyId: string,
  data: { name: string; country?: string; leadTimeDays?: number; notes?: string }
) {
  return prisma.supplier.create({ data: { companyId, ...data } });
}

export async function updateSupplier(
  companyId: string,
  id: string,
  data: Partial<{ name: string; country: string; leadTimeDays: number; notes: string }>
) {
  const existing = await prisma.supplier.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Fornecedor");
  return prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(companyId: string, id: string) {
  const existing = await prisma.supplier.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Fornecedor");
  await prisma.supplier.delete({ where: { id } });
}
