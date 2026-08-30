import type { Request, Response } from "express";
import * as service from "./agent.service";

export async function ask(req: Request, res: Response) {
  const result = await service.askAgent(req.auth!.companyId, req.auth!.userId, req.body.message);
  res.json(result);
}

export async function history(req: Request, res: Response) {
  res.json(await service.getAgentHistory(req.auth!.companyId));
}
