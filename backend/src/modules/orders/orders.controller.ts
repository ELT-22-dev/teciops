import type { Request, Response } from "express";
import * as service from "./orders.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, stage, customerId, search } = req.query as any;
  res.json(await service.listOrders(req.auth!.companyId, { page, pageSize }, { stage, customerId, search }));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getOrder(req.auth!.companyId, req.params.id));
}

export async function create(req: Request, res: Response) {
  const result = await service.createOrder(req.auth!.companyId, req.auth!.userId, req.body);
  res.status(201).json(result);
}

export async function advanceStage(req: Request, res: Response) {
  const result = await service.advanceOrderStage(req.auth!.companyId, req.params.id, req.auth!.userId, req.body.stage);
  res.json(result);
}

export async function cancel(req: Request, res: Response) {
  const result = await service.cancelOrder(req.auth!.companyId, req.params.id, req.auth!.userId);
  res.json(result);
}

export async function kpis(req: Request, res: Response) {
  res.json(await service.getOrderKpis(req.auth!.companyId));
}
