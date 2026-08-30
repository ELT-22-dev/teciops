import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { createArticleSchema, listArticlesQuerySchema, updateArticleSchema } from "./articles.schema";
import * as controller from "./articles.controller";

export const articlesRouter = Router();
articlesRouter.use(requireAuth);

articlesRouter.get("/", validate(listArticlesQuerySchema, "query"), asyncHandler(controller.list));
articlesRouter.get("/:id", asyncHandler(controller.get));
articlesRouter.post("/", validate(createArticleSchema), asyncHandler(controller.create));
articlesRouter.patch("/:id", validate(updateArticleSchema), asyncHandler(controller.update));
articlesRouter.delete("/:id", asyncHandler(controller.remove));
