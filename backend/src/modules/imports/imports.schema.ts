import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createImportLotSchema = z.object({
  supplierId: z.string().min(1),
  articlesDesc: z.string().min(2),
  country: z.string().optional(),
  container: z.string().optional(),
  meters: z.coerce.number().positive(),
  fobUsd: z.coerce.number().positive(),
  exchangeRate: z.coerce.number().positive(),
  eta: z.coerce.date()
});

export const updateImportLotSchema = z.object({
  articlesDesc: z.string().optional(),
  country: z.string().optional(),
  container: z.string().optional(),
  meters: z.coerce.number().positive().optional(),
  fobUsd: z.coerce.number().positive().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  eta: z.coerce.date().optional(),
  status: z.enum(["BOOKED", "SHIPPED", "IN_TRANSIT", "CLEARING", "ARRIVED"]).optional()
});

export const receiveImportLotSchema = z.object({
  rolls: z
    .array(
      z.object({
        articleId: z.string().min(1),
        color: z.string().min(1),
        meters: z.coerce.number().positive(),
        weightKg: z.coerce.number().min(0).optional(),
        warehouse: z.string().min(1),
        location: z.string().optional()
      })
    )
    .min(1, "Informe ao menos um rolo para o recebimento do lote.")
});

export const listImportLotsQuerySchema = paginationSchema.extend({
  status: z.enum(["BOOKED", "SHIPPED", "IN_TRANSIT", "CLEARING", "ARRIVED"]).optional()
});
