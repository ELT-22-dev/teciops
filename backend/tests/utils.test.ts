import { describe, expect, it } from "vitest";
import { computeAutoStatus } from "../src/modules/rolls/rolls.service";
import { buildWhatsAppLink } from "../src/utils/whatsapp";
import { buildPageResult, toSkipTake } from "../src/utils/pagination";

describe("computeAutoStatus", () => {
  it("mantem RESERVED mesmo com saldo alto", () => {
    expect(computeAutoStatus("RESERVED", 500, 500, 5)).toBe("RESERVED");
  });

  it("marca como CRITICAL quando abaixo do limite critico", () => {
    expect(computeAutoStatus("WHOLE", 4, 500, 5)).toBe("CRITICAL");
  });

  it("marca como REMNANT quando abaixo de 30% do inicial", () => {
    expect(computeAutoStatus("WHOLE", 100, 500, 5)).toBe("REMNANT");
  });

  it("marca como WHOLE quando saldo alto", () => {
    expect(computeAutoStatus("WHOLE", 450, 500, 5)).toBe("WHOLE");
  });
});

describe("buildWhatsAppLink", () => {
  it("retorna null sem telefone", () => {
    expect(buildWhatsAppLink(null, "oi")).toBeNull();
    expect(buildWhatsAppLink(undefined, "oi")).toBeNull();
  });

  it("monta link com digitos e mensagem codificada", () => {
    const link = buildWhatsAppLink("+55 11 97412-3388", "Olá Márcia");
    expect(link).toBe("https://wa.me/5511974123388?text=Ol%C3%A1%20M%C3%A1rcia");
  });
});

describe("pagination helpers", () => {
  it("calcula skip/take", () => {
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it("monta o resultado paginado com meta", () => {
    const result = buildPageResult([1, 2, 3], 45, { page: 2, pageSize: 20 });
    expect(result.meta).toEqual({ total: 45, page: 2, pageSize: 20, totalPages: 3 });
  });
});
