import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { advanceStageSchema, createOrderSchema, listOrdersQuerySchema } from "./orders.schema";
import * as controller from "./orders.controller";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get("/", validate(listOrdersQuerySchema, "query"), asyncHandler(controller.list));
ordersRouter.get("/kpis", asyncHandler(controller.kpis));
ordersRouter.get("/:id", asyncHandler(controller.get));
ordersRouter.post("/", validate(createOrderSchema), asyncHandler(controller.create));
ordersRouter.patch("/:id/stage", validate(advanceStageSchema), asyncHandler(controller.advanceStage));
ordersRouter.post("/:id/cancel", asyncHandler(controller.cancel));
