import { prisma } from "../../lib/prisma";
import { syncOverdueTitles } from "../financial/financial.service";

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfPreviousMonth() {
  const d = startOfMonth();
  d.setMonth(d.getMonth() - 1);
  return d;
}

export async function getDashboard(companyId: string) {
  await syncOverdueTitles(companyId);

  const monthStart = startOfMonth();
  const prevMonthStart = startOfPreviousMonth();

  const [currentOrders, previousOrders, openTitlesAgg, overdueTitlesAgg, topArticleRows, topCustomerRows, upcomingLots, criticalRolls, overdueTitles, awaitingCut] =
    await Promise.all([
      prisma.order.findMany({
        where: { companyId, createdAt: { gte: monthStart }, stage: { not: "CANCELLED" } },
        select: { totalValue: true, totalMeters: true, createdAt: true }
      }),
      prisma.order.aggregate({
        where: { companyId, createdAt: { gte: prevMonthStart, lt: monthStart }, stage: { not: "CANCELLED" } },
        _sum: { totalValue: true }
      }),
      prisma.financialTitle.aggregate({
        where: { companyId, status: { in: ["OPEN", "OVERDUE"] } },
        _sum: { value: true },
        _count: true
      }),
      prisma.financialTitle.aggregate({
        where: { companyId, status: "OVERDUE" },
        _sum: { value: true }
      }),
      prisma.orderItem.groupBy({
        by: ["articleId"],
        where: { order: { companyId, createdAt: { gte: monthStart }, stage: { not: "CANCELLED" } } },
        _sum: { totalPrice: true, meters: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 5
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: { companyId, createdAt: { gte: monthStart }, stage: { not: "CANCELLED" } },
        _sum: { totalValue: true },
        _count: true,
        orderBy: { _sum: { totalValue: "desc" } },
        take: 5
      }),
      prisma.importLot.findMany({
        where: { companyId, status: { not: "ARRIVED" } },
        orderBy: { eta: "asc" },
        take: 3,
        include: { supplier: true }
      }),
      prisma.roll.findMany({ where: { companyId, status: "CRITICAL" }, include: { article: true }, take: 10 }),
      prisma.financialTitle.findMany({
        where: { companyId, status: "OVERDUE" },
        include: { customer: true },
        orderBy: { dueDate: "asc" },
        take: 10
      }),
      prisma.order.count({ where: { companyId, stage: "AWAITING_CUT" } })
    ]);

  const revenue = currentOrders.reduce((sum, o) => sum + Number(o.totalValue), 0);
  const metersSold = currentOrders.reduce((sum, o) => sum + Number(o.totalMeters), 0);
  const avgTicket = currentOrders.length > 0 ? revenue / currentOrders.length : 0;
  const previousRevenue = Number(previousOrders._sum.totalValue ?? 0);
  const revenueGrowthPct = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;

  const weeks = new Map<number, number>();
  for (const order of currentOrders) {
    const weekIndex = Math.floor((order.createdAt.getDate() - 1) / 7);
    weeks.set(weekIndex, (weeks.get(weekIndex) ?? 0) + Number(order.totalValue));
  }
  const weeklyRevenue = Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, value]) => ({ week: week + 1, value }));

  const articleIds = topArticleRows.map((r) => r.articleId);
  const articles = await prisma.article.findMany({ where: { id: { in: articleIds } } });
  const topArticles = topArticleRows.map((row) => {
    const article = articles.find((a) => a.id === row.articleId);
    const totalPrice = Number(row._sum.totalPrice ?? 0);
    const costEstimate = article ? Number(article.costPerMeter) * Number(row._sum.meters ?? 0) : 0;
    const margin = totalPrice > 0 ? ((totalPrice - costEstimate) / totalPrice) * 100 : 0;
    return {
      article: article?.name ?? "—",
      value: totalPrice,
      meters: Number(row._sum.meters ?? 0),
      marginPct: Number(margin.toFixed(1)),
      pctOfRevenue: revenue > 0 ? Number(((totalPrice / revenue) * 100).toFixed(1)) : 0
    };
  });

  const customerIds = topCustomerRows.map((r) => r.customerId);
  const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
  const topCustomers = topCustomerRows.map((row) => {
    const customer = customers.find((c) => c.id === row.customerId);
    return {
      customer: customer?.name ?? "—",
      neighborhood: customer?.neighborhood ?? null,
      value: Number(row._sum.totalValue ?? 0),
      orders: row._count
    };
  });

  return {
    kpis: {
      revenue,
      revenueGrowthPct,
      metersSold,
      avgTicket,
      itemsPerOrder: currentOrders.length > 0 ? metersSold / currentOrders.length : 0,
      openReceivable: Number(openTitlesAgg._sum.value ?? 0),
      openTitlesCount: openTitlesAgg._count,
      overdueReceivable: Number(overdueTitlesAgg._sum.value ?? 0)
    },
    weeklyRevenue,
    topArticles,
    topCustomers,
    upcomingLots,
    alerts: {
      criticalRolls,
      overdueTitles,
      ordersAwaitingCut: awaitingCut
    }
  };
}

export async function getMarginsReport(companyId: string) {
  const monthStart = startOfMonth();

  const articles = await prisma.article.findMany({ where: { companyId, active: true } });

  const results = await Promise.all(
    articles.map(async (article) => {
      const [soldAgg, balanceAgg] = await Promise.all([
        prisma.orderItem.aggregate({
          where: { articleId: article.id, order: { createdAt: { gte: monthStart }, stage: { not: "CANCELLED" } } },
          _sum: { meters: true }
        }),
        prisma.roll.aggregate({
          where: { articleId: article.id },
          _sum: { balanceMeters: true }
        })
      ]);

      const metersSoldMonth = Number(soldAgg._sum.meters ?? 0);
      const currentBalance = Number(balanceAgg._sum.balanceMeters ?? 0);
      const cost = Number(article.costPerMeter);
      const sale = Number(article.salePerMeter);
      const marginPct = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
      const turnover = currentBalance > 0 ? metersSoldMonth / currentBalance : metersSoldMonth > 0 ? Infinity : 0;
      const coverageDays = metersSoldMonth > 0 ? Math.round((currentBalance / metersSoldMonth) * 30) : null;

      return {
        article: article.name,
        costPerMeter: cost,
        salePerMeter: sale,
        marginPct: Number(marginPct.toFixed(1)),
        metersSoldMonth,
        currentBalance,
        turnover: Number.isFinite(turnover) ? Number(turnover.toFixed(2)) : null,
        coverageDays
      };
    })
  );

  return results.sort((a, b) => b.metersSoldMonth - a.metersSoldMonth);
}
