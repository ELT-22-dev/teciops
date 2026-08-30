import crypto from "node:crypto";
import { env } from "../../config/env";

export interface FiscalIssueRequest {
  orderCode: string;
  customerName: string;
  customerCnpj?: string | null;
  cfop: string;
  value: number;
  icms: number;
}

export interface FiscalIssueResult {
  status: "AUTHORIZED" | "REJECTED";
  sefazProtocol?: string;
  accessKey?: string;
  rejectionReason?: string;
}

export interface FiscalProvider {
  issue(request: FiscalIssueRequest): Promise<FiscalIssueResult>;
  cancel(accessKey: string): Promise<void>;
}

/**
 * Provedor simulado: "autoriza" a nota localmente sem se comunicar com a SEFAZ.
 * Use isso em desenvolvimento/homologacao. Para producao real, um negocio precisa de:
 *   1. Certificado digital A1 (e-CNPJ) cadastrado num provedor de emissao de NF-e
 *      (ex: Focus NFe, PlugNotas/Tecnospeed, eNotas).
 *   2. Implementar um FiscalProvider real chamando a API desse provedor
 *      (ver FISCAL_PROVIDER_API_KEY / FISCAL_PROVIDER_BASE_URL em .env) e trocar
 *      o valor de FISCAL_PROVIDER em .env de "mock" para o nome do provedor.
 */
class MockFiscalProvider implements FiscalProvider {
  async issue(request: FiscalIssueRequest): Promise<FiscalIssueResult> {
    // Simula uma pequena taxa de rejeicao para exercitar o fluxo de erro (ex: CFOP invalido).
    const looksInvalid = !request.cfop || request.cfop.length < 4;
    if (looksInvalid) {
      return { status: "REJECTED", rejectionReason: "CFOP invalido ou ausente." };
    }

    return {
      status: "AUTHORIZED",
      sefazProtocol: `SP${Date.now()}`,
      accessKey: crypto.randomBytes(22).toString("hex")
    };
  }

  async cancel(_accessKey: string): Promise<void> {
    // No-op no provedor simulado.
  }
}

class UnconfiguredFiscalProvider implements FiscalProvider {
  constructor(private readonly name: string) {}

  async issue(): Promise<FiscalIssueResult> {
    throw new Error(
      `Provedor fiscal "${this.name}" ainda nao esta implementado. Configure FISCAL_PROVIDER_API_KEY/FISCAL_PROVIDER_BASE_URL e implemente a chamada real em src/modules/fiscal/fiscal.provider.ts.`
    );
  }

  async cancel(): Promise<void> {
    throw new Error(`Provedor fiscal "${this.name}" ainda nao esta implementado.`);
  }
}

export function getFiscalProvider(): FiscalProvider {
  switch (env.FISCAL_PROVIDER) {
    case "mock":
      return new MockFiscalProvider();
    default:
      return new UnconfiguredFiscalProvider(env.FISCAL_PROVIDER);
  }
}
