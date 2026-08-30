import { z } from "zod";

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional()
});
