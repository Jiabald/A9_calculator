import type { NextFunction, Request, Response } from "express";
import { tradeReviewService } from "../service/tradeReviewService.js";

function getIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const tradeReviewController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tradeReviewService.listReviews(req.query.page, req.query.pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await tradeReviewService.getReview(getIdParam(req));
      res.json(record);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await tradeReviewService.createReview(req.body);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  }
};
