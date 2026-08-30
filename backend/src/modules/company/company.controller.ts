import type { Request, Response } from "express";
import * as service from "./company.service";

export async function get(req: Request, res: Response) {
  res.json(await service.getCompany(req.auth!.companyId));
}

export async function update(req: Request, res: Response) {
  res.json(await service.updateCompany(req.auth!.companyId, req.body));
}
