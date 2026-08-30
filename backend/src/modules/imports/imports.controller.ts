import type { Request, Response } from "express";
import * as service from "./imports.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, status } = req.query as any;
  res.json(await service.listImportLots(req.auth!.companyId, { page, pageSize }, status));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getImportLot(req.auth!.companyId, req.params.id));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.createImportLot(req.auth!.companyId, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await service.updateImportLot(req.auth!.companyId, req.params.id, req.body));
}

export async function receive(req: Request, res: Response) {
  res.status(201).json(await service.receiveImportLot(req.auth!.companyId, req.params.id, req.body.rolls));
}
