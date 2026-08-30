import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
  createImportLotSchema,
  listImportLotsQuerySchema,
  receiveImportLotSchema,
  updateImportLotSchema
} from "./imports.schema";
import * as controller from "./imports.controller";

export const importsRouter = Router();
importsRouter.use(requireAuth);

importsRouter.get("/", validate(listImportLotsQuerySchema, "query"), asyncHandler(controller.list));
importsRouter.get("/:id", asyncHandler(controller.get));
importsRouter.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  validate(createImportLotSchema),
  asyncHandler(controller.create)
);
importsRouter.patch(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateImportLotSchema),
  asyncHandler(controller.update)
);
importsRouter.post(
  "/:id/receive",
  requireRole("OWNER", "MANAGER", "WAREHOUSE"),
  validate(receiveImportLotSchema),
  asyncHandler(controller.receive)
);
