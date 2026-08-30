import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createCustomerSchema = z.object({
  name: z.string().min(2),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0)
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersQuerySchema = paginationSchema.extend({
  search: z.string().optional()
});
