import type { NextFunction, Request, Response } from "express";
import { positionService } from "../service/positionService.js";

function getIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const positionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await positionService.listPositions(req.query.page, req.query.pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await positionService.createPosition(req.body);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  },

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await positionService.replacePosition(getIdParam(req), req.body);
      res.json(record);
    } catch (error) {
      next(error);
    }
  },

  async patch(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await positionService.patchPosition(getIdParam(req), req.body);
      res.json(record);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await positionService.deletePosition(getIdParam(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
};
