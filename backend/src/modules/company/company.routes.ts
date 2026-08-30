import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { updateCompanySchema } from "./company.schema";
import * as controller from "./company.controller";

export const companyRouter = Router();
companyRouter.use(requireAuth);

companyRouter.get("/", asyncHandler(controller.get));
companyRouter.patch("/", requireRole("OWNER", "MANAGER"), validate(updateCompanySchema), asyncHandler(controller.update));
