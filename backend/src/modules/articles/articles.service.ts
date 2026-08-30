import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";

export async function listArticles(companyId: string, pagination: Pagination, search?: string) {
  const where = {
    companyId,
    active: true,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.article.findMany({ where, orderBy: { name: "asc" }, ...toSkipTake(pagination) }),
    prisma.article.count({ where })
  ]);

  return buildPageResult(items, total, pagination);
}

export async function getArticle(companyId: string, id: string) {
  const article = await prisma.article.findFirst({
    where: { id, companyId },
    include: { rolls: { where: { balanceMeters: { gt: 0 } }, orderBy: { createdAt: "desc" } } }
  });
  if (!article) throw AppError.notFound("Artigo");
  return article;
}

export async function createArticle(
  companyId: string,
  data: { name: string; composition?: string; widthMeters?: number; costPerMeter?: number; salePerMeter?: number }
) {
  return prisma.article.create({ data: { companyId, ...data } });
}

export async function updateArticle(
  companyId: string,
  id: string,
  data: Partial<{ name: string; composition: string; widthMeters: number; costPerMeter: number; salePerMeter: number }>
) {
  const existing = await prisma.article.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Artigo");
  return prisma.article.update({ where: { id }, data });
}

export async function deleteArticle(companyId: string, id: string) {
  const existing = await prisma.article.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Artigo");
  await prisma.article.update({ where: { id }, data: { active: false } });
}
