import type { NextFunction, Request, Response } from "express";
import { principalService } from "../service/principalService.js";

export const principalController = {
  async getCurrent(_req: Request, res: Response, next: NextFunction) {
    try {
      const principal = await principalService.getCurrentPrincipal();
      res.json({ principal });
    } catch (error) {
      next(error);
    }
  }
};
