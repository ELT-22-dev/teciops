import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { createCustomerSchema, listCustomersQuerySchema, updateCustomerSchema } from "./customers.schema";
import * as controller from "./customers.controller";

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get("/", validate(listCustomersQuerySchema, "query"), asyncHandler(controller.list));
customersRouter.get("/:id", asyncHandler(controller.get));
customersRouter.get("/:id/statement", asyncHandler(controller.statement));
customersRouter.post("/", validate(createCustomerSchema), asyncHandler(controller.create));
customersRouter.patch("/:id", validate(updateCustomerSchema), asyncHandler(controller.update));
customersRouter.delete("/:id", asyncHandler(controller.remove));
