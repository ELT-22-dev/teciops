import type { Request, Response } from "express";
import * as service from "./financial.service";

export async function listTitles(req: Request, res: Response) {
  const { page, pageSize, status, customerId, isCaderneta } = req.query as any;
  res.json(await service.listTitles(req.auth!.companyId, { page, pageSize }, { status, customerId, isCaderneta }));
}

export async function aging(req: Request, res: Response) {
  res.json(await service.getAging(req.auth!.companyId));
}

export async function createCaderneta(req: Request, res: Response) {
  res.status(201).json(await service.createCaderneta(req.auth!.companyId, req.body));
}

export async function payTitle(req: Request, res: Response) {
  res.json(await service.payTitle(req.auth!.companyId, req.params.id, req.body.paidAt));
}

export async function chargeTitle(req: Request, res: Response) {
  res.json(await service.chargeTitle(req.auth!.companyId, req.params.id));
}
