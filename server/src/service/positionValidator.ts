import { DEFAULT_PRINCIPAL } from "../types.js";
import type { PositionInput, TradeSide } from "../types.js";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRequiredNumber(input: Partial<PositionInput>, field: keyof PositionInput) {
  const value = input[field];
  if (!isFiniteNumber(value)) {
    throw new Error(`${String(field)} 必须是有效数字`);
  }
  return value;
}

export function validatePositionInput(body: unknown): PositionInput {
  const input = body as Partial<PositionInput>;

  if (typeof input.symbol !== "string" || input.symbol.trim().length === 0) {
    throw new Error("品种不能为空");
  }

  if (input.side !== "long" && input.side !== "short") {
    throw new Error("方向必须是 long 或 short");
  }

  if (input.takeProfit !== undefined && !isFiniteNumber(input.takeProfit)) {
    throw new Error("takeProfit 必须是有效数字");
  }

  if (input.closePrice !== undefined && !isFiniteNumber(input.closePrice)) {
    throw new Error("closePrice 必须是有效数字");
  }

  if (typeof input.tradeDate !== "string" || input.tradeDate.trim().length === 0) {
    throw new Error("日期不能为空");
  }

  if (input.principal !== undefined && !isFiniteNumber(input.principal)) {
    throw new Error("principal 必须是有效数字");
  }

  if (input.fundingFee !== undefined && !isFiniteNumber(input.fundingFee)) {
    throw new Error("fundingFee 必须是有效数字");
  }

  const reviewId = normalizeReviewId(input.reviewId);

  return {
    symbol: input.symbol.trim().toUpperCase(),
    side: input.side as TradeSide,
    entryPrice: getRequiredNumber(input, "entryPrice"),
    stopLoss: getRequiredNumber(input, "stopLoss"),
    takeProfit: input.takeProfit,
    leverage: getRequiredNumber(input, "leverage"),
    positionSize: getRequiredNumber(input, "positionSize"),
    positionValue: getRequiredNumber(input, "positionValue"),
    riskAmount: getRequiredNumber(input, "riskAmount"),
    lossRatio: getRequiredNumber(input, "lossRatio"),
    openFeeRate: getRequiredNumber(input, "openFeeRate"),
    closeFeeRate: getRequiredNumber(input, "closeFeeRate"),
    principal: input.principal ?? DEFAULT_PRINCIPAL,
    fundingFee: input.fundingFee ?? 0,
    closePrice: input.closePrice,
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
    reviewId,
    tradeDate: input.tradeDate
  };
}

function normalizeReviewId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("reviewId 格式无效");
  }
  return value.trim();
}

const NUMERIC_POSITION_FIELDS = [
  "entryPrice",
  "stopLoss",
  "leverage",
  "positionSize",
  "positionValue",
  "riskAmount",
  "lossRatio",
  "openFeeRate",
  "closeFeeRate",
  "principal",
  "fundingFee"
] as const;

export function validatePartialPositionInput(body: unknown): Partial<PositionInput> {
  if (!body || typeof body !== "object") {
    throw new Error("请求体不能为空");
  }

  const input = body as Partial<PositionInput> & {
    takeProfit?: number | null;
    closePrice?: number | null;
    reviewId?: string | null;
  };
  const result: Partial<PositionInput> = {};

  if (input.symbol !== undefined) {
    if (typeof input.symbol !== "string" || input.symbol.trim().length === 0) {
      throw new Error("品种不能为空");
    }
    result.symbol = input.symbol.trim().toUpperCase();
  }

  if (input.side !== undefined) {
    if (input.side !== "long" && input.side !== "short") {
      throw new Error("方向必须是 long 或 short");
    }
    result.side = input.side as TradeSide;
  }

  for (const field of NUMERIC_POSITION_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (!isFiniteNumber(value)) {
      throw new Error(`${field} 必须是有效数字`);
    }
    result[field] = value;
  }

  if (input.takeProfit !== undefined) {
    if (input.takeProfit === null) {
      result.takeProfit = undefined;
    } else if (!isFiniteNumber(input.takeProfit)) {
      throw new Error("takeProfit 必须是有效数字");
    } else {
      result.takeProfit = input.takeProfit;
    }
  }

  if (input.closePrice !== undefined) {
    if (input.closePrice === null) {
      result.closePrice = undefined;
    } else if (!isFiniteNumber(input.closePrice)) {
      throw new Error("closePrice 必须是有效数字");
    } else {
      result.closePrice = input.closePrice;
    }
  }

  if (input.notes !== undefined) {
    result.notes = typeof input.notes === "string" ? input.notes.trim() : "";
  }

  if (input.tradeDate !== undefined) {
    if (typeof input.tradeDate !== "string" || input.tradeDate.trim().length === 0) {
      throw new Error("日期不能为空");
    }
    result.tradeDate = input.tradeDate;
  }

  if (input.reviewId !== undefined) {
    result.reviewId = normalizeReviewId(input.reviewId);
  }

  return result;
}
