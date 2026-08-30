import type { Request, Response } from "express";
import * as service from "./fiscal.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, status } = req.query as any;
  res.json(await service.listFiscalNotes(req.auth!.companyId, { page, pageSize }, status));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getFiscalNote(req.auth!.companyId, req.params.id));
}

export async function issue(req: Request, res: Response) {
  const { orderId, cfop, icmsRate } = req.body;
  res.status(201).json(await service.issueFiscalNote(req.auth!.companyId, orderId, cfop, icmsRate));
}

export async function cancel(req: Request, res: Response) {
  res.json(await service.cancelFiscalNote(req.auth!.companyId, req.params.id));
}
