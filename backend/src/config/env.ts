import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL e obrigatorio"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET deve ter pelo menos 16 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET deve ter pelo menos 16 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("*"),
  FISCAL_PROVIDER: z.enum(["mock", "focus_nfe", "plugnotas"]).default("mock"),
  FISCAL_PROVIDER_API_KEY: z.string().optional().default(""),
  FISCAL_PROVIDER_BASE_URL: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  RATE_LIMIT_MAX: z.coerce.number().default(300)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuracao de ambiente invalida. Verifique o arquivo .env (veja .env.example).");
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());
