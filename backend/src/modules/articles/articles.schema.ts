import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const createArticleSchema = z.object({
  name: z.string().min(2),
  composition: z.string().optional(),
  widthMeters: z.coerce.number().positive().optional(),
  costPerMeter: z.coerce.number().min(0).default(0),
  salePerMeter: z.coerce.number().min(0).default(0)
});

export const updateArticleSchema = createArticleSchema.partial();

export const listArticlesQuerySchema = paginationSchema.extend({
  search: z.string().optional()
});
