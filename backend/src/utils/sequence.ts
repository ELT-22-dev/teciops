import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Gera o proximo codigo sequencial de um prefixo (ex: PED-, TIT-, R-, LT-) para a empresa,
 * olhando o maior sufixo numerico ja usado na tabela informada.
 *
 * Nao e uma sequence de banco (Postgres SEQUENCE) porque cada entidade tem seu proprio
 * namespace por empresa; a unicidade final e garantida pela constraint @@unique([companyId, code])
 * de cada tabela - se colidir por concorrencia, o service que chamou deve tratar o erro P2002 e tentar de novo.
 */
const CODE_FIELD: Record<"order" | "financialTitle" | "roll" | "importLot" | "fiscalNote", string> = {
  order: "code",
  financialTitle: "code",
  roll: "code",
  importLot: "code",
  fiscalNote: "number"
};

export async function nextSequenceCode(
  tx: Tx,
  table: "order" | "financialTitle" | "roll" | "importLot" | "fiscalNote",
  companyId: string,
  prefix: string,
  startAt = 1000
): Promise<string> {
  const field = CODE_FIELD[table];
  const delegate = (tx as any)[table] as {
    findMany: (args: any) => Promise<Array<Record<string, string>>>;
  };

  const rows = await delegate.findMany({
    where: { companyId, [field]: { startsWith: prefix } },
    select: { [field]: true }
  });

  let max = startAt;
  for (const row of rows) {
    const suffix = row[field]!.slice(prefix.length);
    const asNumber = Number(suffix);
    if (Number.isFinite(asNumber) && asNumber > max) {
      max = asNumber;
    }
  }

  return `${prefix}${max + 1}`;
}
