import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { createSupplierSchema, listSuppliersQuerySchema, updateSupplierSchema } from "./suppliers.schema";
import * as controller from "./suppliers.controller";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

suppliersRouter.get("/", validate(listSuppliersQuerySchema, "query"), asyncHandler(controller.list));
suppliersRouter.get("/:id", asyncHandler(controller.get));
suppliersRouter.post("/", validate(createSupplierSchema), asyncHandler(controller.create));
suppliersRouter.patch("/:id", validate(updateSupplierSchema), asyncHandler(controller.update));
suppliersRouter.delete("/:id", asyncHandler(controller.remove));
