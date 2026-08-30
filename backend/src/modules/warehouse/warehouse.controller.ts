import type { Request, Response } from "express";
import * as service from "./warehouse.service";

export async function lookup(req: Request, res: Response) {
  res.json(await service.lookupRollByCode(req.auth!.companyId, (req.query as any).code));
}

export async function list(req: Request, res: Response) {
  const { page, pageSize, status } = req.query as any;
  res.json(await service.listConferences(req.auth!.companyId, { page, pageSize }, status));
}

export async function queue(req: Request, res: Response) {
  res.json(await service.pendingQueue(req.auth!.companyId));
}

export async function create(req: Request, res: Response) {
  const { rollId, countedMeters } = req.body;
  res.status(201).json(await service.createConference(req.auth!.companyId, req.auth!.userId, rollId, countedMeters));
}

export async function resolve(req: Request, res: Response) {
  res.json(await service.resolveConference(req.auth!.companyId, req.params.id, req.auth!.userId, req.body.applyAdjustment));
}
