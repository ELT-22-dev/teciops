import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./reports.controller";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/dashboard", asyncHandler(controller.dashboard));
reportsRouter.get("/margins", asyncHandler(controller.margins));
