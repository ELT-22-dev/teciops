import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createRollSchema = z.object({
  articleId: z.string().min(1),
  color: z.string().min(1),
  initialMeters: z.coerce.number().positive(),
  weightKg: z.coerce.number().min(0).optional(),
  warehouse: z.string().min(1),
  location: z.string().optional(),
  landedCost: z.coerce.number().min(0).optional(),
  importLotId: z.string().optional(),
  criticalBelowMeters: z.coerce.number().min(0).default(5)
});

export const updateRollSchema = z.object({
  color: z.string().optional(),
  warehouse: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["WHOLE", "RESERVED", "REMNANT", "CRITICAL"]).optional(),
  landedCost: z.coerce.number().min(0).optional(),
  criticalBelowMeters: z.coerce.number().min(0).optional()
});

export const adjustRollSchema = z.object({
  countedMeters: z.coerce.number().min(0),
  reason: z.string().optional()
});

export const listRollsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(["WHOLE", "RESERVED", "REMNANT", "CRITICAL"]).optional(),
  warehouse: z.string().optional(),
  articleId: z.string().optional()
});
