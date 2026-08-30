import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { createCadernetaSchema, listTitlesQuerySchema, payTitleSchema } from "./financial.schema";
import * as controller from "./financial.controller";

export const financialRouter = Router();
financialRouter.use(requireAuth);

financialRouter.get("/titles", validate(listTitlesQuerySchema, "query"), asyncHandler(controller.listTitles));
financialRouter.get("/titles/aging", asyncHandler(controller.aging));
financialRouter.post(
  "/titles/caderneta",
  requireRole("OWNER", "MANAGER", "FINANCE", "SELLER"),
  validate(createCadernetaSchema),
  asyncHandler(controller.createCaderneta)
);
financialRouter.post(
  "/titles/:id/pay",
  requireRole("OWNER", "MANAGER", "FINANCE"),
  validate(payTitleSchema),
  asyncHandler(controller.payTitle)
);
financialRouter.post("/titles/:id/charge", asyncHandler(controller.chargeTitle));
