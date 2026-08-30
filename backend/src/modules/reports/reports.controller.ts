import type { Request, Response } from "express";
import * as service from "./reports.service";

export async function dashboard(req: Request, res: Response) {
  res.json(await service.getDashboard(req.auth!.companyId));
}

export async function margins(req: Request, res: Response) {
  res.json(await service.getMarginsReport(req.auth!.companyId));
}
