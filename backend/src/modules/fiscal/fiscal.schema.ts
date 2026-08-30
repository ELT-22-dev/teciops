import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const issueFiscalNoteSchema = z.object({
  orderId: z.string().min(1),
  cfop: z.string().min(4, "Informe um CFOP valido (ex: 5.102)."),
  icmsRate: z.coerce.number().min(0).max(100).default(18)
});

export const listFiscalNotesQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "AUTHORIZED", "REJECTED", "CANCELLED"]).optional()
});
