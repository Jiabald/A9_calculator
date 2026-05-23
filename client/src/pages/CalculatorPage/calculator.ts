import type { PositionPayload, PositionRecord, TradeSide } from "../../types";
import { absDiff, add, div, mul, percentOf, round, sub } from "../../utils/precision";

export type CalculatorForm = {
  accountBalance: string;
  riskPercent: string;
  symbol: string;
  side: TradeSide;
  entryPrice: string;
  stopLoss: string;
  leverage: string;
  openFeeRate: string;
  closeFeeRate: string;
  notes: string;
};

export type CalculationResult = {
  isValid: boolean;
  riskAmount: number;
  priceLossRatio: number;
  feeRatio: number;
  totalLossRatio: number;
  positionValue: number;
  positionSize: number;
  openFeeAmount: number;
  margin: number;
  message?: string;
};

export type TradeResult = {
  feeLoss: number;
  profitLoss: number;
};

export const today = new Date().toISOString().slice(0, 10);

export const initialForm: CalculatorForm = {
  accountBalance: "200",
  riskPercent: "5",
  symbol: "BTCUSDT",
  side: "long",
  entryPrice: "",
  stopLoss: "",
  leverage: "10",
  openFeeRate: "0.05",
  closeFeeRate: "0.05",
  notes: ""
};

export const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6
});

export function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value: number) {
  return compactFormatter.format(value);
}

/** 格式化为百分比显示（ratio 为小数，如 0.0123 → "1.2300%"） */
export function formatRatioPercent(ratio: number, digits = 4): string {
  return `${round(mul(ratio, 100), digits).toFixed(digits)}%`;
}

/** 格式化为已存储的百分比数值（如 lossRatio = 1.23 表示 1.23%） */
export function formatLossRatioPercent(value: number, digits = 4): string {
  return `${round(value, digits).toFixed(digits)}%`;
}

/** 价格止损距离占入场价的比例（小数） */
export function calcPriceLossRatio(entryPrice: number, stopLoss: number): number {
  if (entryPrice <= 0) return 0;
  return div(absDiff(entryPrice, stopLoss), entryPrice);
}

/** 开仓+平仓手续费率之和（小数，如 0.001 表示 0.1%） */
export function calcFeeRatio(openFeeRatePercent: number, closeFeeRatePercent: number): number {
  return div(add(openFeeRatePercent, closeFeeRatePercent), 100);
}

/** 总亏损比例（小数）= 价格止损比例 + 手续费比例 */
export function calcTotalLossRatio(
  entryPrice: number,
  stopLoss: number,
  openFeeRatePercent: number,
  closeFeeRatePercent: number
): number {
  return add(calcPriceLossRatio(entryPrice, stopLoss), calcFeeRatio(openFeeRatePercent, closeFeeRatePercent));
}

/** 总亏损比例（百分比数值，如 1.23 表示 1.23%） */
export function calcLossRatioPercent(
  entryPrice: number,
  stopLoss: number,
  openFeeRatePercent: number,
  closeFeeRatePercent: number
): number {
  return mul(calcTotalLossRatio(entryPrice, stopLoss, openFeeRatePercent, closeFeeRatePercent), 100);
}

export function calcPositionSize(positionValue: number, entryPrice: number): number {
  if (entryPrice <= 0) return 0;
  return div(positionValue, entryPrice);
}

export function calcRiskAmountFromLossRatio(positionValue: number, lossRatioPercent: number): number {
  return percentOf(positionValue, lossRatioPercent);
}

export function calcSidePriceDiff(
  side: TradeSide,
  entryPrice: number,
  closePrice: number
): number {
  return side === "long" ? sub(closePrice, entryPrice) : sub(entryPrice, closePrice);
}

export function getTradeResult(record: PositionRecord): TradeResult | null {
  if (record.closePrice === undefined) {
    return null;
  }

  const openFee = percentOf(record.positionValue, record.openFeeRate);
  const closeValue = mul(record.closePrice, record.positionSize);
  const closeFee = percentOf(closeValue, record.closeFeeRate);
  const priceDiff = calcSidePriceDiff(record.side, record.entryPrice, record.closePrice);
  const priceProfitLoss = mul(priceDiff, record.positionSize);
  const feeLoss = add(openFee, closeFee);

  return {
    feeLoss,
    profitLoss: sub(priceProfitLoss, feeLoss)
  };
}

export function calculatePosition(form: CalculatorForm): CalculationResult {
  const accountBalance = toNumber(form.accountBalance);
  const riskPercent = toNumber(form.riskPercent);
  const entryPrice = toNumber(form.entryPrice);
  const stopLoss = toNumber(form.stopLoss);
  const leverage = toNumber(form.leverage);
  const openFeeRatePercent = toNumber(form.openFeeRate);
  const closeFeeRatePercent = toNumber(form.closeFeeRate);
  const openFeeRate = div(openFeeRatePercent, 100);
  const closeFeeRate = div(closeFeeRatePercent, 100);
  const riskAmount = percentOf(accountBalance, riskPercent);
  const priceLossRatio = calcPriceLossRatio(entryPrice, stopLoss);
  const feeRatio = add(openFeeRate, closeFeeRate);
  const totalLossRatio = add(priceLossRatio, feeRatio);

  if (accountBalance <= 0 || riskPercent <= 0) {
    return emptyResult(riskAmount, "请输入账户资金和亏损比例");
  }

  if (riskPercent > 20) {
    return emptyResult(riskAmount, "亏损比例不能超过 20%");
  }

  if (entryPrice <= 0 || stopLoss <= 0 || leverage <= 0) {
    return emptyResult(riskAmount, "请输入入场价格、止损价格和杠杆");
  }

  if (form.side === "long" && stopLoss >= entryPrice) {
    return emptyResult(riskAmount, "做多止损价格不能高于或等于入场价格");
  }

  if (form.side === "short" && stopLoss <= entryPrice) {
    return emptyResult(riskAmount, "做空止损价格不能低于或等于入场价格");
  }

  if (totalLossRatio <= 0) {
    return emptyResult(riskAmount, "止损距离和手续费不能同时为 0");
  }

  const positionValue = div(riskAmount, totalLossRatio);
  const positionSize = calcPositionSize(positionValue, entryPrice);

  return {
    isValid: true,
    riskAmount,
    priceLossRatio,
    feeRatio,
    totalLossRatio,
    positionValue,
    positionSize,
    openFeeAmount: mul(positionValue, openFeeRate),
    margin: div(positionValue, leverage)
  };
}

export function createOpenRecordPayload(
  input: {
    symbol: string;
    side: TradeSide;
    entryPrice: number;
    stopLoss: number;
    takeProfit?: number;
    leverage: number;
    positionValue: number;
    openFeeRate: number;
    closeFeeRate: number;
    notes: string;
  }
): PositionPayload {
  const lossRatio = calcLossRatioPercent(
    input.entryPrice,
    input.stopLoss,
    input.openFeeRate,
    input.closeFeeRate
  );

  return {
    symbol: input.symbol,
    side: input.side,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    leverage: input.leverage,
    positionSize: calcPositionSize(input.positionValue, input.entryPrice),
    positionValue: input.positionValue,
    riskAmount: calcRiskAmountFromLossRatio(input.positionValue, lossRatio),
    lossRatio,
    openFeeRate: input.openFeeRate,
    closeFeeRate: input.closeFeeRate,
    closePrice: undefined,
    notes: input.notes,
    tradeDate: today
  };
}

export function createPayload(form: CalculatorForm, result: CalculationResult): PositionPayload {
  return {
    symbol: form.symbol,
    side: form.side,
    entryPrice: toNumber(form.entryPrice),
    stopLoss: toNumber(form.stopLoss),
    takeProfit: undefined,
    leverage: toNumber(form.leverage),
    positionSize: result.positionSize,
    positionValue: result.positionValue,
    riskAmount: result.riskAmount,
    lossRatio: mul(result.totalLossRatio, 100),
    openFeeRate: toNumber(form.openFeeRate),
    closeFeeRate: toNumber(form.closeFeeRate),
    closePrice: undefined,
    notes: form.notes,
    tradeDate: today
  };
}

function emptyResult(riskAmount: number, message: string): CalculationResult {
  return {
    isValid: false,
    riskAmount,
    priceLossRatio: 0,
    feeRatio: 0,
    totalLossRatio: 0,
    positionValue: 0,
    positionSize: 0,
    openFeeAmount: 0,
    margin: 0,
    message
  };
}
