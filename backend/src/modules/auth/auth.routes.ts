import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { createUserSchema, loginSchema, refreshSchema, registerCompanySchema } from "./auth.schema";
import * as controller from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", validate(registerCompanySchema), asyncHandler(controller.register));
authRouter.post("/login", validate(loginSchema), asyncHandler(controller.login));
authRouter.post("/refresh", validate(refreshSchema), asyncHandler(controller.refresh));
authRouter.post("/logout", validate(refreshSchema), asyncHandler(controller.logout));
authRouter.get("/me", requireAuth, asyncHandler(controller.me));
authRouter.get("/users", requireAuth, requireRole("OWNER", "MANAGER"), asyncHandler(controller.listUsers));
authRouter.post(
  "/users",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  validate(createUserSchema),
  asyncHandler(controller.createUser)
);
