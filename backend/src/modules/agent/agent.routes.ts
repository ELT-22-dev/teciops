import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { askAgentSchema } from "./agent.schema";
import * as controller from "./agent.controller";

export const agentRouter = Router();
agentRouter.use(requireAuth);

agentRouter.post("/ask", validate(askAgentSchema), asyncHandler(controller.ask));
agentRouter.get("/history", asyncHandler(controller.history));
