import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  country: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional()
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = paginationSchema.extend({
  search: z.string().optional()
});
