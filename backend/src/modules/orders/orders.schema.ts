import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const orderItemInputSchema = z.object({
  articleId: z.string().min(1),
  rollId: z.string().optional(),
  color: z.string().min(1),
  meters: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive()
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(["COUNTER", "WHOLESALE"]).default("COUNTER"),
  paymentMethod: z.enum(["CASH", "PIX", "CARD", "BOLETO", "TERM"]),
  items: z.array(orderItemInputSchema).min(1, "O pedido precisa de ao menos um item."),
  discount: z.coerce.number().min(0).default(0),
  immediateCut: z.boolean().default(true),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional()
});

export const advanceStageSchema = z.object({
  stage: z.enum(["QUOTE", "AWAITING_CUT", "CUT", "INVOICED", "DELIVERED", "CANCELLED"])
});

export const listOrdersQuerySchema = paginationSchema.extend({
  stage: z.enum(["QUOTE", "AWAITING_CUT", "CUT", "INVOICED", "DELIVERED", "CANCELLED"]).optional(),
  customerId: z.string().optional(),
  search: z.string().optional()
});
