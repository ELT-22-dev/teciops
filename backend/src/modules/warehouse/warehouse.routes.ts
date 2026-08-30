import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import {
  createConferenceSchema,
  listConferencesQuerySchema,
  lookupRollQuerySchema,
  resolveConferenceSchema
} from "./warehouse.schema";
import * as controller from "./warehouse.controller";

export const warehouseRouter = Router();
warehouseRouter.use(requireAuth);

warehouseRouter.get("/rolls/lookup", validate(lookupRollQuerySchema, "query"), asyncHandler(controller.lookup));
warehouseRouter.get("/conferences", validate(listConferencesQuerySchema, "query"), asyncHandler(controller.list));
warehouseRouter.get("/conferences/queue", asyncHandler(controller.queue));
warehouseRouter.post("/conferences", validate(createConferenceSchema), asyncHandler(controller.create));
warehouseRouter.post(
  "/conferences/:id/resolve",
  validate(resolveConferenceSchema),
  asyncHandler(controller.resolve)
);
