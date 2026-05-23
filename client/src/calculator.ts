import type { PositionPayload, TradeSide } from "./types";

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

export function calculatePosition(form: CalculatorForm): CalculationResult {
  const accountBalance = toNumber(form.accountBalance);
  const riskPercent = toNumber(form.riskPercent);
  const entryPrice = toNumber(form.entryPrice);
  const stopLoss = toNumber(form.stopLoss);
  const leverage = toNumber(form.leverage);
  const openFeeRate = toNumber(form.openFeeRate) / 100;
  const closeFeeRate = toNumber(form.closeFeeRate) / 100;
  const riskAmount = accountBalance * (riskPercent / 100);
  const priceLossRatio = entryPrice > 0 ? Math.abs(entryPrice - stopLoss) / entryPrice : 0;
  const feeRatio = openFeeRate + closeFeeRate;
  const totalLossRatio = priceLossRatio + feeRatio;

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

  const positionValue = riskAmount / totalLossRatio;
  const positionSize = positionValue / entryPrice;

  return {
    isValid: true,
    riskAmount,
    priceLossRatio,
    feeRatio,
    totalLossRatio,
    positionValue,
    positionSize,
    openFeeAmount: positionValue * openFeeRate,
    margin: positionValue / leverage
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
    lossRatio: result.totalLossRatio * 100,
    openFeeRate: toNumber(form.openFeeRate),
    closeFeeRate: toNumber(form.closeFeeRate),
    closePrice: undefined,
    notes: form.notes,
    tradeDate: new Date().toISOString().slice(0, 10)
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
