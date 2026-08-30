import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo1234!";

async function main() {
  console.log("Limpando dados existentes...");
  await prisma.agentMessage.deleteMany();
  await prisma.conference.deleteMany();
  await prisma.fiscalNote.deleteMany();
  await prisma.financialTitle.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.importLot.deleteMany();
  await prisma.article.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log("Criando empresa e usuarios...");
  const company = await prisma.company.create({
    data: {
      name: "tecidOps · Brás",
      cnpj: "12.345.678/0001-90",
      phone: "+55 11 3229-4410",
      address: "Rua do Brás, 480 - São Paulo/SP"
    }
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const owner = await prisma.user.create({
    data: { companyId: company.id, name: "Rogério Lima", email: "owner@tecidops.com.br", passwordHash, role: "OWNER" }
  });
  const seller = await prisma.user.create({
    data: { companyId: company.id, name: "Wilson Andrade", email: "wilson@tecidops.com.br", passwordHash, role: "SELLER" }
  });
  await prisma.user.create({
    data: { companyId: company.id, name: "Deposito A", email: "deposito@tecidops.com.br", passwordHash, role: "WAREHOUSE" }
  });
  await prisma.user.create({
    data: { companyId: company.id, name: "Marcia Reis", email: "financeiro@tecidops.com.br", passwordHash, role: "FINANCE" }
  });

  console.log("Criando fornecedores...");
  const supplierChina = await prisma.supplier.create({
    data: { companyId: company.id, name: "Zhejiang Textile Co.", country: "China", leadTimeDays: 45 }
  });
  const supplierSul = await prisma.supplier.create({
    data: { companyId: company.id, name: "Malhas do Sul", country: "Brasil", leadTimeDays: 10 }
  });
  const supplierIndia = await prisma.supplier.create({
    data: { companyId: company.id, name: "India Fabrics Ltd", country: "India", leadTimeDays: 50 }
  });

  console.log("Criando artigos...");
  const articlesData = [
    { name: "Malha PV 30.1", composition: "67% PES 33% VIS", widthMeters: 1.8, costPerMeter: 16.8, salePerMeter: 27.9 },
    { name: "Crepe Amanda", composition: "100% PES", widthMeters: 1.5, costPerMeter: 11.4, salePerMeter: 21.5 },
    { name: "Suplex Fitness", composition: "90% PA 10% EL", widthMeters: 1.6, costPerMeter: 23.1, salePerMeter: 38.0 },
    { name: "Tricoline Fio Tinto", composition: "100% ALG", widthMeters: 1.5, costPerMeter: 14.2, salePerMeter: 26.4 },
    { name: "Viscose Lisa", composition: "100% VIS", widthMeters: 1.45, costPerMeter: 15.1, salePerMeter: 26.9 },
    { name: "Sarja com Elastano", composition: "97% ALG 3% EL", widthMeters: 1.6, costPerMeter: 19.6, salePerMeter: 32.9 },
    { name: "Oxford Liso", composition: "100% PES", widthMeters: 1.5, costPerMeter: 9.8, salePerMeter: 18.5 },
    { name: "Linho Misto", composition: "55% LI 45% VIS", widthMeters: 1.4, costPerMeter: 28.4, salePerMeter: 49.0 }
  ];
  const articles: Record<string, Awaited<ReturnType<typeof prisma.article.create>>> = {};
  for (const data of articlesData) {
    articles[data.name] = await prisma.article.create({ data: { companyId: company.id, ...data } });
  }

  console.log("Criando lotes de importacao...");
  const lotArrived1 = await prisma.importLot.create({
    data: {
      companyId: company.id,
      code: "LT-2601",
      supplierId: supplierIndia.id,
      articlesDesc: "Tricoline Fio Tinto, Viscose Lisa",
      country: "India",
      container: "CONT-88213",
      meters: 4200,
      fobUsd: 9800,
      exchangeRate: 5.3,
      costPerMeter: (9800 * 5.3) / 4200,
      eta: new Date(Date.now() - 40 * 86_400_000),
      status: "ARRIVED",
      receivedAt: new Date(Date.now() - 38 * 86_400_000)
    }
  });
  const lotArrived2 = await prisma.importLot.create({
    data: {
      companyId: company.id,
      code: "LT-2609",
      supplierId: supplierChina.id,
      articlesDesc: "Crepe Amanda",
      country: "China",
      container: "CONT-90441",
      meters: 3600,
      fobUsd: 7200,
      exchangeRate: 5.35,
      costPerMeter: (7200 * 5.35) / 3600,
      eta: new Date(Date.now() - 20 * 86_400_000),
      status: "ARRIVED",
      receivedAt: new Date(Date.now() - 18 * 86_400_000)
    }
  });
  const lotArrived3 = await prisma.importLot.create({
    data: {
      companyId: company.id,
      code: "LT-2612",
      supplierId: supplierChina.id,
      articlesDesc: "Suplex Fitness",
      country: "China",
      container: "CONT-91820",
      meters: 2800,
      fobUsd: 10800,
      exchangeRate: 5.38,
      costPerMeter: (10800 * 5.38) / 2800,
      eta: new Date(Date.now() - 12 * 86_400_000),
      status: "ARRIVED",
      receivedAt: new Date(Date.now() - 10 * 86_400_000)
    }
  });
  const lotTransit = await prisma.importLot.create({
    data: {
      companyId: company.id,
      code: "LT-2618",
      supplierId: supplierChina.id,
      articlesDesc: "Malha PV 30.1",
      country: "China",
      container: "CONT-93310",
      meters: 8400,
      fobUsd: 26100,
      exchangeRate: 5.42,
      costPerMeter: (26100 * 5.42) / 8400,
      eta: new Date(Date.now() + 3 * 86_400_000),
      status: "IN_TRANSIT"
    }
  });
  await prisma.importLot.create({
    data: {
      companyId: company.id,
      code: "LT-2621",
      supplierId: supplierSul.id,
      articlesDesc: "Sarja com Elastano, Oxford Liso",
      country: "Brasil",
      container: "-",
      meters: 3100,
      fobUsd: 21500,
      exchangeRate: 1,
      costPerMeter: 21500 / 3100,
      eta: new Date(Date.now() + 15 * 86_400_000),
      status: "BOOKED"
    }
  });

  console.log("Criando rolos de estoque...");
  const rollsData = [
    { code: "R-4412", article: "Malha PV 30.1", color: "Preto", initialMeters: 412, weightKg: 120, warehouse: "DEP-A", location: "P12", status: "WHOLE", landedCost: 16.8, lot: lotArrived1 },
    { code: "R-4413", article: "Malha PV 30.1", color: "Off White", initialMeters: 268, weightKg: 78, warehouse: "DEP-A", location: "P12", status: "WHOLE", landedCost: 16.8, lot: lotArrived1 },
    { code: "R-4430", article: "Crepe Amanda", color: "Rosé", initialMeters: 504, weightKg: 68, warehouse: "DEP-A", location: "P07", status: "WHOLE", landedCost: 11.4, lot: lotArrived2 },
    { code: "R-4433", article: "Crepe Amanda", color: "Preto", initialMeters: 68.5, weightKg: 9.3, warehouse: "DEP-A", location: "P07", status: "WHOLE", landedCost: 11.4, lot: lotArrived2 },
    { code: "R-4421", article: "Suplex Fitness", color: "Marinho", initialMeters: 186, weightKg: 56.6, warehouse: "DEP-B", location: "P02", status: "WHOLE", landedCost: 23.1, lot: lotArrived3 },
    { code: "R-4402", article: "Tricoline Fio Tinto", color: "Azul Royal", initialMeters: 330, weightKg: 43, warehouse: "DEP-A", location: "P09", status: "RESERVED", landedCost: 14.2, lot: lotArrived1 },
    { code: "R-4408", article: "Sarja com Elastano", color: "Bege", initialMeters: 212, weightKg: 93.6, warehouse: "DEP-B", location: "P05", status: "RESERVED", landedCost: 19.6, lot: null },
    { code: "R-4390", article: "Viscose Lisa", color: "Vinho", initialMeters: 94, weightKg: 22.8, warehouse: "DEP-A", location: "P04", status: "WHOLE", landedCost: 15.1, lot: lotArrived1 },
    { code: "R-4377", article: "Oxford Liso", color: "Preto", initialMeters: 148, weightKg: 42.2, warehouse: "DEP-A", location: "P02", status: "WHOLE", landedCost: 9.8, lot: null },
    { code: "R-4356", article: "Linho Misto", color: "Cru", initialMeters: 34, weightKg: 10.5, warehouse: "DEP-A", location: "P01", status: "CRITICAL", landedCost: 28.4, lot: null }
  ] as const;

  const rolls: Record<string, Awaited<ReturnType<typeof prisma.roll.create>>> = {};
  for (const data of rollsData) {
    const roll = await prisma.roll.create({
      data: {
        companyId: company.id,
        code: data.code,
        articleId: articles[data.article]!.id,
        color: data.color,
        initialMeters: data.initialMeters,
        balanceMeters: data.initialMeters,
        weightKg: data.weightKg,
        warehouse: data.warehouse,
        location: data.location,
        status: data.status,
        landedCost: data.landedCost,
        importLotId: data.lot?.id ?? null,
        criticalBelowMeters: 5
      }
    });
    rolls[data.code] = roll;
    await prisma.stockMovement.create({
      data: { companyId: company.id, rollId: roll.id, type: "IN", meters: data.initialMeters, reason: "Carga inicial (seed)" }
    });
  }

  console.log("Criando clientes...");
  const customersData = [
    { name: "Aurora Confecções", phone: "+55 11 97412-3388", neighborhood: "Brás", cnpj: "12.480.331/0001-09", creditLimit: 40000 },
    { name: "Malharia Dinâmica", phone: "+55 11 98122-0417", neighborhood: "Brás", creditLimit: 25000 },
    { name: "Vitrine Kids", phone: "+55 11 99304-7761", neighborhood: "Bom Retiro", creditLimit: 15000 },
    { name: "Atacado Nova Era", phone: "+55 11 98765-0122", neighborhood: "Brás", creditLimit: 30000 },
    { name: "JS Modas", phone: "+55 11 97633-8890", neighborhood: "Brás", creditLimit: 18000 },
    { name: "Studio Bianca", phone: "+55 11 99541-2207", neighborhood: "Pari", creditLimit: 12000 },
    { name: "Rei do Jeans", phone: "+55 11 98200-4573", neighborhood: "Brás", creditLimit: 22000 },
    { name: "Confecção Litoral", phone: "+55 11 97011-8842", neighborhood: "Santos", creditLimit: 10000 },
    { name: "Costura da Néia", phone: "+55 11 98477-2019", neighborhood: "Bom Retiro", creditLimit: 6000 },
    { name: "Ateliê Sol", phone: "+55 11 97355-0164", neighborhood: "Brás", creditLimit: 8000 },
    { name: "Marcos Uniformes", phone: "+55 11 99287-0431", neighborhood: "Mooca", creditLimit: 20000 },
    { name: "Dona Rita", phone: "+55 11 97120-4488", neighborhood: "Brás", creditLimit: 3000 }
  ];
  const customers: Record<string, Awaited<ReturnType<typeof prisma.customer.create>>> = {};
  for (const data of customersData) {
    customers[data.name] = await prisma.customer.create({ data: { companyId: company.id, ...data } });
  }

  console.log("Criando pedidos, titulos e movimentacoes...");

  async function createOrder(opts: {
    code: string;
    customer: string;
    stage: "QUOTE" | "AWAITING_CUT" | "CUT" | "INVOICED" | "DELIVERED";
    paymentMethod: "CASH" | "PIX" | "CARD" | "BOLETO" | "TERM";
    items: Array<{ roll: string; meters: number }>;
    daysAgo: number;
    dueInDays?: number;
    isCaderneta?: boolean;
  }) {
    const items = opts.items.map((i) => {
      const roll = rolls[i.roll]!;
      return { roll, meters: i.meters };
    });
    const totalMeters = items.reduce((s, i) => s + i.meters, 0);

    let totalValue = 0;
    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        code: opts.code,
        customerId: customers[opts.customer]!.id,
        sellerId: seller.id,
        channel: "COUNTER",
        stage: opts.stage,
        paymentMethod: opts.paymentMethod,
        totalMeters,
        totalValue: 0,
        createdAt: new Date(Date.now() - opts.daysAgo * 86_400_000)
      }
    });

    for (const item of items) {
      const article = await prisma.article.findUniqueOrThrow({ where: { id: item.roll.articleId } });
      const unitPrice = Number(article.salePerMeter);
      const totalPrice = unitPrice * item.meters;
      totalValue += totalPrice;

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          articleId: item.roll.articleId,
          rollId: item.roll.id,
          color: item.roll.color,
          meters: item.meters,
          unitPrice,
          totalPrice
        }
      });

      if (opts.stage !== "QUOTE") {
        const currentRoll = await prisma.roll.findUniqueOrThrow({ where: { id: item.roll.id } });
        const newBalance = Number(currentRoll.balanceMeters) - item.meters;
        await prisma.roll.update({ where: { id: item.roll.id }, data: { balanceMeters: Math.max(0, newBalance) } });
        await prisma.stockMovement.create({
          data: {
            companyId: company.id,
            rollId: item.roll.id,
            type: "OUT",
            meters: item.meters,
            reason: `Corte para pedido ${opts.code}`,
            orderId: order.id,
            userId: seller.id
          }
        });
      }
    }

    await prisma.order.update({ where: { id: order.id }, data: { totalValue } });

    if (opts.paymentMethod === "TERM" || opts.paymentMethod === "BOLETO") {
      const dueDate = new Date(Date.now() + (opts.dueInDays ?? 30) * 86_400_000);
      await prisma.financialTitle.create({
        data: {
          companyId: company.id,
          code: `TIT-${1100 + Math.floor(Math.random() * 900)}`,
          customerId: customers[opts.customer]!.id,
          orderId: order.id,
          value: totalValue,
          dueDate,
          paymentMethod: opts.paymentMethod,
          status: dueDate < new Date() ? "OVERDUE" : "OPEN",
          isCaderneta: !!opts.isCaderneta
        }
      });
    }

    return order;
  }

  await createOrder({
    code: "PED-2418",
    customer: "Aurora Confecções",
    stage: "CUT",
    paymentMethod: "TERM",
    items: [{ roll: "R-4412", meters: 120 }],
    daysAgo: 8,
    dueInDays: 15
  });

  await createOrder({
    code: "PED-2402",
    customer: "Malharia Dinâmica",
    stage: "INVOICED",
    paymentMethod: "BOLETO",
    items: [{ roll: "R-4413", meters: 85 }],
    daysAgo: 11,
    dueInDays: -22 // ja vencido
  });

  await createOrder({
    code: "PED-2377",
    customer: "JS Modas",
    stage: "DELIVERED",
    paymentMethod: "PIX",
    items: [{ roll: "R-4430", meters: 40 }],
    daysAgo: 16
  });

  await createOrder({
    code: "PED-2415",
    customer: "Vitrine Kids",
    stage: "CUT",
    paymentMethod: "CASH",
    items: [{ roll: "R-4433", meters: 20 }],
    daysAgo: 3
  });

  await createOrder({
    code: "PED-2398",
    customer: "Rei do Jeans",
    stage: "AWAITING_CUT",
    paymentMethod: "TERM",
    items: [{ roll: "R-4421", meters: 30 }],
    daysAgo: 2,
    dueInDays: -98 // titulo bem antigo/vencido para simular inadimplencia
  });

  await createOrder({
    code: "PED-2440",
    customer: "Confecção Litoral",
    stage: "CUT",
    paymentMethod: "TERM",
    items: [{ roll: "R-4390", meters: 12 }],
    daysAgo: 30,
    dueInDays: -98,
    isCaderneta: true
  });

  await createOrder({
    code: "PED-2441",
    customer: "Dona Rita",
    stage: "CUT",
    paymentMethod: "TERM",
    items: [{ roll: "R-4377", meters: 6 }],
    daysAgo: 5,
    dueInDays: 10,
    isCaderneta: true
  });

  console.log("Seed concluido.");
  console.log("----------------------------------------------------");
  console.log("Login de demonstracao:");
  console.log(`  E-mail: ${owner.email}`);
  console.log(`  Senha:  ${DEMO_PASSWORD}`);
  console.log("----------------------------------------------------");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
