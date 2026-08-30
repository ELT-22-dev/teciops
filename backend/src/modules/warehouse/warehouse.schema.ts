import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createConferenceSchema = z.object({
  rollId: z.string().min(1),
  countedMeters: z.coerce.number().min(0)
});

export const resolveConferenceSchema = z.object({
  applyAdjustment: z.boolean().default(false)
});

export const listConferencesQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "CONFIRMED", "DIVERGENT"]).optional()
});

export const lookupRollQuerySchema = z.object({
  code: z.string().min(1)
});
