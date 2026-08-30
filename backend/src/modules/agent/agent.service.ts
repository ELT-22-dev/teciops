import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { buildWhatsAppLink } from "../../utils/whatsapp";
import { syncOverdueTitles } from "../financial/financial.service";

interface AgentLine {
  label: string;
  value: string;
}

interface AgentReply {
  text: string;
  lines: AgentLine[];
  action?: string;
  whatsappLink?: string | null;
}

type IntentHandler = (companyId: string, message: string) => Promise<AgentReply>;

async function handleStock(companyId: string): Promise<AgentReply> {
  const rolls = await prisma.roll.findMany({ where: { companyId }, include: { article: true } });
  const byArticle = new Map<string, number>();
  for (const roll of rolls) {
    byArticle.set(roll.article.name, (byArticle.get(roll.article.name) ?? 0) + Number(roll.balanceMeters));
  }
  const sorted = [...byArticle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const critical = rolls.filter((r) => r.status === "CRITICAL");

  return {
    text: "Saldo disponivel por artigo (somando todos os rolos, incluindo reservados):",
    lines: [
      ...sorted.map(([name, meters]) => ({ label: name, value: `${meters.toFixed(1)} m` })),
      ...(critical.length > 0
        ? [{ label: `${critical.length} ROLO(S) EM NIVEL CRITICO`, value: critical.map((r) => r.code).join(", ") }]
        : [])
    ],
    action: "ABRIR ESTOQUE"
  };
}

async function handleReceivables(companyId: string): Promise<AgentReply> {
  await syncOverdueTitles(companyId);
  const overdue = await prisma.financialTitle.findMany({
    where: { companyId, status: "OVERDUE" },
    include: { customer: true },
    orderBy: { value: "desc" },
    take: 5
  });
  const total = overdue.reduce((sum, t) => sum + Number(t.value), 0);
  const top = overdue[0];

  return {
    text:
      overdue.length > 0
        ? `R$ ${total.toFixed(2)} vencidos em ${overdue.length} titulo(s). ${top ? `${top.customer.name} concentra o maior valor.` : ""}`
        : "Nenhum titulo em atraso no momento.",
    lines: overdue.map((t) => ({
      label: `${t.customer.name.toUpperCase()} · ${t.code}`,
      value: `R$ ${Number(t.value).toFixed(2)}`
    })),
    action: overdue.length > 0 ? "REGISTRAR CONTATO" : undefined,
    whatsappLink: top
      ? buildWhatsAppLink(
          top.customer.phone,
          `Bom dia, aqui e da loja. O titulo ${top.code} de R$ ${Number(top.value).toFixed(2)} venceu em ${top.dueDate.toLocaleDateString("pt-BR")}. Consegue acertar hoje?`
        )
      : null
  };
}

async function handleOrders(companyId: string): Promise<AgentReply> {
  const orders = await prisma.order.findMany({
    where: { companyId, stage: "AWAITING_CUT" },
    include: { customer: true },
    orderBy: { createdAt: "asc" }
  });
  const totalMeters = orders.reduce((sum, o) => sum + Number(o.totalMeters), 0);

  return {
    text: `${orders.length} pedido(s) aguardando corte, ${totalMeters.toFixed(0)} m no total.`,
    lines: orders.slice(0, 5).map((o) => ({ label: `${o.code} · ${o.customer.name.toUpperCase()}`, value: `${Number(o.totalMeters).toFixed(0)} m` })),
    action: orders.length > 0 ? "VER PEDIDOS" : undefined
  };
}

async function handleImports(companyId: string): Promise<AgentReply> {
  const lots = await prisma.importLot.findMany({
    where: { companyId, status: { not: "ARRIVED" } },
    orderBy: { eta: "asc" },
    take: 5
  });

  return {
    text: lots.length > 0 ? `${lots.length} lote(s) em curso.` : "Nenhum lote em transito no momento.",
    lines: lots.map((l) => ({ label: `${l.code} · ${l.status}`, value: `ETA ${l.eta.toLocaleDateString("pt-BR")}` })),
    action: "VER IMPORTACAO"
  };
}

async function handleCustomer(companyId: string, message: string): Promise<AgentReply> {
  const customers = await prisma.customer.findMany({ where: { companyId, active: true } });
  const lower = message.toLowerCase();
  const match = customers.find((c) => lower.includes((c.name.toLowerCase().split(" ")[0] ?? "").toLowerCase()));

  if (!match) {
    return {
      text: "Nao identifiquei o cliente na mensagem. Cite o nome da confeccao para eu consultar limite e situacao.",
      lines: []
    };
  }

  const openTitles = await prisma.financialTitle.aggregate({
    where: { customerId: match.id, status: { in: ["OPEN", "OVERDUE"] } },
    _sum: { value: true }
  });
  const openBalance = Number(openTitles._sum.value ?? 0);
  const available = Number(match.creditLimit) - openBalance;

  return {
    text: `${match.name}: limite de R$ ${Number(match.creditLimit).toFixed(2)}, em aberto R$ ${openBalance.toFixed(2)}.`,
    lines: [
      { label: "EM ABERTO", value: `R$ ${openBalance.toFixed(2)}` },
      { label: "LIMITE DISPONIVEL", value: `R$ ${available.toFixed(2)}` }
    ],
    action: "ABRIR FICHA"
  };
}

const RULES: Array<{ keywords: string[]; handler: IntentHandler }> = [
  { keywords: ["estoque", "saldo", "rolo", "malha", "tem "], handler: handleStock },
  { keywords: ["atras", "cobran", "receber", "devendo", "inadim"], handler: handleReceivables },
  { keywords: ["pedido", "corte", "cortar", "separa"], handler: handleOrders },
  { keywords: ["lote", "importa", "chega", "container", "cambio", "câmbio"], handler: handleImports },
  { keywords: ["cliente", "limite", "credito", "crédito"], handler: handleCustomer }
];

async function fallbackToClaude(message: string, companyId: string): Promise<AgentReply | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  try {
    const [rollCount, openOrders, openTitlesAgg] = await Promise.all([
      prisma.roll.count({ where: { companyId } }),
      prisma.order.count({ where: { companyId, stage: { not: "CANCELLED" } } }),
      prisma.financialTitle.aggregate({ where: { companyId, status: { in: ["OPEN", "OVERDUE"] } }, _sum: { value: true } })
    ]);

    const snapshot = `Contexto da loja: ${rollCount} rolos cadastrados, ${openOrders} pedidos ativos, R$ ${Number(openTitlesAgg._sum.value ?? 0).toFixed(2)} em titulos a receber.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system:
          "Voce e o Agente OPS, assistente interno de uma loja de tecidos (TecidOps). Responda em portugues, de forma curta e objetiva, com base apenas no contexto fornecido. Se nao souber, diga que precisa consultar o sistema.",
        messages: [{ role: "user", content: `${snapshot}\n\nPergunta do usuario: ${message}` }]
      })
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "Falha ao chamar Claude para o Agente OPS");
      return null;
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) return null;

    return { text, lines: [] };
  } catch (err) {
    logger.warn({ err }, "Erro ao consultar Claude para o Agente OPS");
    return null;
  }
}

export async function askAgent(companyId: string, userId: string, message: string): Promise<AgentReply> {
  await prisma.agentMessage.create({ data: { companyId, userId, role: "user", content: message } });

  const lower = message.toLowerCase();
  const rule = RULES.find((r) => r.keywords.some((k) => lower.includes(k)));

  let reply: AgentReply;
  if (rule) {
    reply = await rule.handler(companyId, message);
  } else {
    reply =
      (await fallbackToClaude(message, companyId)) ?? {
        text: "Nao entendi a pergunta. Tente perguntar sobre estoque, pedidos aguardando corte, titulos em atraso, importacao ou um cliente especifico.",
        lines: []
      };
  }

  await prisma.agentMessage.create({ data: { companyId, userId, role: "assistant", content: reply.text } });

  return reply;
}

export async function getAgentHistory(companyId: string, limit = 30) {
  return prisma.agentMessage.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
