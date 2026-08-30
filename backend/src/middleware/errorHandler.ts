import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../lib/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Rota nao encontrada.", path: req.originalUrl });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Dados invalidos.",
      details: err.flatten()
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe um registro com esses dados (violacao de unicidade).", fields: err.meta?.target });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Registro nao encontrado." });
    }
  }

  logger.error({ err }, "Erro nao tratado");
  return res.status(500).json({ error: "Erro interno do servidor." });
}
