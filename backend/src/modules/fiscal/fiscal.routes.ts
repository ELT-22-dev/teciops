import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { issueFiscalNoteSchema, listFiscalNotesQuerySchema } from "./fiscal.schema";
import * as controller from "./fiscal.controller";

export const fiscalRouter = Router();
fiscalRouter.use(requireAuth);

fiscalRouter.get("/notes", validate(listFiscalNotesQuerySchema, "query"), asyncHandler(controller.list));
fiscalRouter.get("/notes/:id", asyncHandler(controller.get));
fiscalRouter.post(
  "/notes",
  requireRole("OWNER", "MANAGER", "FINANCE", "SELLER"),
  validate(issueFiscalNoteSchema),
  asyncHandler(controller.issue)
);
fiscalRouter.post("/notes/:id/cancel", requireRole("OWNER", "MANAGER", "FINANCE"), asyncHandler(controller.cancel));
