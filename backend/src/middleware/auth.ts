import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export interface AccessTokenPayload {
  sub: string; // userId
  companyId: string;
  role: Role;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(AppError.unauthorized("Token de acesso ausente."));
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.auth = { userId: payload.sub, companyId: payload.companyId, role: payload.role };
    return next();
  } catch {
    return next(AppError.unauthorized("Token de acesso invalido ou expirado."));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(AppError.forbidden(`Esta acao requer um dos perfis: ${roles.join(", ")}.`));
    }
    return next();
  };
}
