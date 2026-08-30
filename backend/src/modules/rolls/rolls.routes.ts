import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { adjustRollSchema, createRollSchema, listRollsQuerySchema, updateRollSchema } from "./rolls.schema";
import * as controller from "./rolls.controller";

export const rollsRouter = Router();
rollsRouter.use(requireAuth);

rollsRouter.get("/", validate(listRollsQuerySchema, "query"), asyncHandler(controller.list));
rollsRouter.get("/:id", asyncHandler(controller.get));
rollsRouter.post(
  "/",
  requireRole("OWNER", "MANAGER", "WAREHOUSE"),
  validate(createRollSchema),
  asyncHandler(controller.create)
);
rollsRouter.patch(
  "/:id",
  requireRole("OWNER", "MANAGER", "WAREHOUSE"),
  validate(updateRollSchema),
  asyncHandler(controller.update)
);
rollsRouter.post(
  "/:id/adjust",
  requireRole("OWNER", "MANAGER", "WAREHOUSE"),
  validate(adjustRollSchema),
  asyncHandler(controller.adjust)
);
