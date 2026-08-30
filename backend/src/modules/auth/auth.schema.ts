import { z } from "zod";

export const registerCompanySchema = z.object({
  companyName: z.string().min(2, "Nome da empresa muito curto"),
  companyCnpj: z.string().optional(),
  ownerName: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail invalido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres")
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(1, "Senha obrigatoria")
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, "refreshToken invalido")
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["OWNER", "MANAGER", "SELLER", "WAREHOUSE", "FINANCE"]).default("SELLER")
});

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
