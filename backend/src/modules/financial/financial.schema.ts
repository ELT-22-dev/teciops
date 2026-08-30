import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const listTitlesQuerySchema = paginationSchema.extend({
  status: z.enum(["OPEN", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  customerId: z.string().optional(),
  isCaderneta: z.coerce.boolean().optional()
});

export const createCadernetaSchema = z.object({
  customerId: z.string().min(1),
  value: z.coerce.number().positive(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional()
});

export const payTitleSchema = z.object({
  paidAt: z.coerce.date().optional()
});
