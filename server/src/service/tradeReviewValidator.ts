import type { TradeReviewInput, TradeReviewSide } from "../types/tradeReview.js";

const MAX_SCREENSHOTS = 9;
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_300 = 300;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireString(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field}不能为空`);
  }
  const trimmed = value.trim();
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`${field}不能超过 ${maxLength} 字`);
  }
  return trimmed;
}

function optionalString(value: unknown, maxLength?: number): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("文本字段格式无效");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`文本不能超过 ${maxLength} 字`);
  }
  return trimmed;
}

function validateScreenshots(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("请至少上传一张交易截图");
  }
  if (value.length > MAX_SCREENSHOTS) {
    throw new Error(`最多上传 ${MAX_SCREENSHOTS} 张截图`);
  }

  const screenshots: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error("截图格式无效");
    }
    const src = item.trim();
    if (!src.startsWith("data:image/") && !src.startsWith("http://") && !src.startsWith("https://")) {
      throw new Error("截图必须是图片地址或粘贴的图片数据");
    }
    const approxBytes = src.startsWith("data:") ? Math.ceil((src.length * 3) / 4) : 0;
    if (approxBytes > MAX_SCREENSHOT_BYTES) {
      throw new Error("单张截图不能超过 3MB");
    }
    screenshots.push(src);
  }
  return screenshots;
}

function validateSide(value: unknown): TradeReviewSide {
  if (value !== "long" && value !== "short") {
    throw new Error("方向必须是 long 或 short");
  }
  return value;
}

function validateTradeDate(value: unknown): string {
  const date = requireString(value, "交易日期");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("交易日期格式应为 YYYY-MM-DD");
  }
  return date;
}

export function validateTradeReviewInput(body: unknown): TradeReviewInput {
  const input = body as Partial<TradeReviewInput>;

  const profitLoss = input.profitLoss;
  if (profitLoss !== undefined && !isFiniteNumber(profitLoss)) {
    throw new Error("盈亏必须是有效数字");
  }

  const riskReward = input.riskReward;
  if (riskReward !== undefined && !isFiniteNumber(riskReward)) {
    throw new Error("盈亏比必须是有效数字");
  }

  const executionConfidence = input.executionConfidence;
  if (executionConfidence !== undefined) {
    if (!Number.isInteger(executionConfidence) || executionConfidence < 1 || executionConfidence > 5) {
      throw new Error("执行信心必须是 1-5 的整数");
    }
  }

  return {
    screenshots: validateScreenshots(input.screenshots),
    strategy: requireString(input.strategy, "交易策略", 128),
    symbol: requireString(input.symbol, "交易标的", 64),
    side: validateSide(input.side),
    entryMode: requireString(input.entryMode, "入场模式", 64),
    tradeDate: validateTradeDate(input.tradeDate),
    timeframe: optionalString(input.timeframe, 16),
    entryReason: requireString(input.entryReason, "入场理由"),
    profitTarget: requireString(input.profitTarget, "盈利目标", MAX_TEXT_300),
    initialStopLoss: requireString(input.initialStopLoss, "初始止损", MAX_TEXT_300),
    reviewNotes: optionalString(input.reviewNotes),
    profitLoss,
    riskReward,
    marketCycle: optionalString(input.marketCycle, 64),
    tradeType: optionalString(input.tradeType, 64),
    executionConfidence
  };
}
