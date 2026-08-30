import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPageResult, toSkipTake, type Pagination } from "../../utils/pagination";

export async function listCustomers(companyId: string, pagination: Pagination, search?: string) {
  const where = {
    companyId,
    active: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { cnpj: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: "asc" }, ...toSkipTake(pagination) }),
    prisma.customer.count({ where })
  ]);

  const withOpenBalance = await Promise.all(
    items.map(async (customer) => {
      const openTitles = await prisma.financialTitle.aggregate({
        where: { customerId: customer.id, status: { in: ["OPEN", "OVERDUE"] } },
        _sum: { value: true }
      });
      const orderCount = await prisma.order.count({ where: { customerId: customer.id, stage: { not: "CANCELLED" } } });
      return {
        ...customer,
        openBalance: openTitles._sum.value ?? 0,
        orderCount
      };
    })
  );

  return buildPageResult(withOpenBalance, total, pagination);
}

export async function getCustomer(companyId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) throw AppError.notFound("Cliente");

  const [orders, openTitles, mixRows] = await Promise.all([
    prisma.order.findMany({
      where: { companyId, customerId: id, stage: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.financialTitle.findMany({
      where: { companyId, customerId: id, status: { in: ["OPEN", "OVERDUE"] } },
      orderBy: { dueDate: "asc" }
    }),
    prisma.orderItem.groupBy({
      by: ["articleId"],
      where: { order: { companyId, customerId: id } },
      _sum: { meters: true },
      orderBy: { _sum: { meters: "desc" } },
      take: 5
    })
  ]);

  const articleIds = mixRows.map((r) => r.articleId);
  const articles = await prisma.article.findMany({ where: { id: { in: articleIds } } });
  const habitualMix = mixRows.map((row) => ({
    article: articles.find((a) => a.id === row.articleId)?.name ?? "—",
    meters: row._sum.meters ?? 0
  }));

  const openBalance = openTitles.reduce((sum, t) => sum + Number(t.value), 0);
  const availableCredit = Number(customer.creditLimit) - openBalance;

  return {
    ...customer,
    stats: {
      orderCount: orders.length,
      openBalance,
      availableCredit,
      habitualMix
    },
    recentOrders: orders,
    openTitles
  };
}

export async function getCustomerStatement(companyId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) throw AppError.notFound("Cliente");

  const [orders, titles] = await Promise.all([
    prisma.order.findMany({
      where: { companyId, customerId: id },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.financialTitle.findMany({
      where: { companyId, customerId: id },
      orderBy: { dueDate: "desc" }
    })
  ]);

  return { customer, orders, titles };
}

export async function createCustomer(companyId: string, data: {
  name: string;
  cnpj?: string;
  phone?: string;
  neighborhood?: string;
  address?: string;
  creditLimit?: number;
}) {
  return prisma.customer.create({
    data: {
      companyId,
      name: data.name,
      cnpj: data.cnpj,
      phone: data.phone,
      neighborhood: data.neighborhood,
      address: data.address,
      creditLimit: data.creditLimit ?? 0
    }
  });
}

export async function updateCustomer(
  companyId: string,
  id: string,
  data: Partial<{
    name: string;
    cnpj: string;
    phone: string;
    neighborhood: string;
    address: string;
    creditLimit: number;
  }>
) {
  const existing = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Cliente");
  return prisma.customer.update({ where: { id }, data });
}

export async function deleteCustomer(companyId: string, id: string) {
  const existing = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound("Cliente");
  await prisma.customer.update({ where: { id }, data: { active: false } });
}
