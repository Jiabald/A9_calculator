import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/HttpError.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof Error) {
    res.status(400).json({ message: error.message || "请求处理失败" });
    return;
  }

  res.status(500).json({ message: "服务器内部错误" });
}
