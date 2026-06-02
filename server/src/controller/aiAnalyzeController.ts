import type { NextFunction, Request, Response } from "express";
import { aiAnalyzeService } from "../service/ai/aiAnalyzeService.js";
import type { AnalyzeRequest } from "../service/ai/types.js";

export const aiAnalyzeController = {
  async analyze(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req.body ?? {}) as Partial<AnalyzeRequest>;
      const symbol = typeof body.symbol === "string" ? body.symbol : "";
      if (!symbol.trim()) {
        throw new Error("缺少参数 symbol");
      }

      const result = await aiAnalyzeService.analyze({
        symbol,
        apiBase: typeof body.apiBase === "string" ? body.apiBase : undefined,
        klineInterval: typeof body.klineInterval === "string" ? body.klineInterval : undefined,
        klineLimit: typeof body.klineLimit === "number" ? body.klineLimit : undefined
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
  async analyzeStream(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req.body ?? {}) as Partial<AnalyzeRequest>;
      const symbol = typeof body.symbol === "string" ? body.symbol : "";
      if (!symbol.trim()) {
        throw new Error("缺少参数 symbol");
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write("");

      const controller = new AbortController();
      req.on("aborted", () => controller.abort());
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });

      const result = await aiAnalyzeService.analyzeStream(
        {
          symbol,
          apiBase: typeof body.apiBase === "string" ? body.apiBase : undefined,
          klineInterval: typeof body.klineInterval === "string" ? body.klineInterval : undefined,
          klineLimit: typeof body.klineLimit === "number" ? body.klineLimit : undefined
        },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            res.write(delta);
          }
        }
      );

      res.write(`\n\n__A9_ANALYZE_FINAL__\n${JSON.stringify(result)}\n`);
      res.end();
    } catch (error) {
      if (res.headersSent) {
        try {
          const msg = error instanceof Error ? error.message : "分析失败";
          res.write(`\n\n[ERROR] ${msg}\n`);
        } finally {
          res.end();
        }
        return;
      }
      next(error);
    }
  }
};

