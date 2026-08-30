import type { Request, Response } from "express";
import * as service from "./customers.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, search } = req.query as unknown as { page: number; pageSize: number; search?: string };
  const result = await service.listCustomers(req.auth!.companyId, { page, pageSize }, search);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const result = await service.getCustomer(req.auth!.companyId, req.params.id);
  res.json(result);
}

export async function statement(req: Request, res: Response) {
  const result = await service.getCustomerStatement(req.auth!.companyId, req.params.id);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const result = await service.createCustomer(req.auth!.companyId, req.body);
  res.status(201).json(result);
}

export async function update(req: Request, res: Response) {
  const result = await service.updateCustomer(req.auth!.companyId, req.params.id, req.body);
  res.json(result);
}

export async function remove(req: Request, res: Response) {
  await service.deleteCustomer(req.auth!.companyId, req.params.id);
  res.status(204).send();
}
