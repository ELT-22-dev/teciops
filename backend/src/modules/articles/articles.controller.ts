import type { Request, Response } from "express";
import * as service from "./articles.service";

export async function list(req: Request, res: Response) {
  const { page, pageSize, search } = req.query as unknown as { page: number; pageSize: number; search?: string };
  res.json(await service.listArticles(req.auth!.companyId, { page, pageSize }, search));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getArticle(req.auth!.companyId, req.params.id));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.createArticle(req.auth!.companyId, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await service.updateArticle(req.auth!.companyId, req.params.id, req.body));
}

export async function remove(req: Request, res: Response) {
  await service.deleteArticle(req.auth!.companyId, req.params.id);
  res.status(204).send();
}
