import type { Request, Response } from "express";
import * as authService from "./auth.service";
import { AppError } from "../../utils/AppError";

export async function register(req: Request, res: Response) {
  const result = await authService.registerCompany(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refreshSession(req.body.refreshToken);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized();
  const result = await authService.getMe(req.auth.userId);
  res.status(200).json(result);
}

export async function createUser(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized();
  const result = await authService.createCompanyUser(req.auth.companyId, req.body);
  res.status(201).json(result);
}

export async function listUsers(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized();
  const result = await authService.listCompanyUsers(req.auth.companyId);
  res.status(200).json(result);
}
