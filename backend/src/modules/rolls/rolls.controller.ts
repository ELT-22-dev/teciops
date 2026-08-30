import type { Request, Response } from "express";
import * as service from "./rolls.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, search, status, warehouse, articleId } = req.query as any;
  res.json(await service.listRolls(req.auth!.companyId, { page, pageSize }, { search, status, warehouse, articleId }));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getRoll(req.auth!.companyId, req.params.id));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.createRoll(req.auth!.companyId, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await service.updateRoll(req.auth!.companyId, req.params.id, req.body));
}

export async function adjust(req: Request, res: Response) {
  const { countedMeters, reason } = req.body;
  res.json(await service.adjustRoll(req.auth!.companyId, req.params.id, countedMeters, reason, req.auth!.userId));
}
