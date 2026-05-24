import type { PositionRecord } from "../types.js";

export type TradeResult = {
  feeLoss: number;
  profitLoss: number;
};

export function getTradeResult(record: PositionRecord): TradeResult | null {
  if (record.closePrice === undefined) {
    return null;
  }

  const openFee = (record.positionValue * record.openFeeRate) / 100;
  const closeValue = record.closePrice * record.positionSize;
  const closeFee = (closeValue * record.closeFeeRate) / 100;
  const priceDiff =
    record.side === "long"
      ? record.closePrice - record.entryPrice
      : record.entryPrice - record.closePrice;
  const priceProfitLoss = priceDiff * record.positionSize;
  const feeLoss = openFee + closeFee;
  const fundingFee = record.fundingFee ?? 0;

  return {
    feeLoss,
    profitLoss: priceProfitLoss - feeLoss + fundingFee
  };
}

export function getCurrentPrincipalFromRecord(record: PositionRecord): number {
  const tradeResult = getTradeResult(record);
  if (tradeResult) {
    return record.principal + tradeResult.profitLoss;
  }
  return record.principal;
}
