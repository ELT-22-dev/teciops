import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw AppError.notFound("Empresa");
  return company;
}

export async function updateCompany(
  companyId: string,
  data: Partial<{ name: string; cnpj: string; phone: string; address: string }>
) {
  return prisma.company.update({ where: { id: companyId }, data });
}
