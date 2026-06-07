export type TradeSide = "long" | "short";

export const DEFAULT_PRINCIPAL = 200;

export interface PositionRecord {
  id: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  leverage: number;
  positionSize: number;
  positionValue: number;
  riskAmount: number;
  lossRatio: number;
  openFeeRate: number;
  closeFeeRate: number;
  principal: number;
  fundingFee: number;
  closePrice?: number;
  notes?: string;
  reviewId?: string;
  tradeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type PositionInput = Omit<PositionRecord, "id" | "createdAt" | "updatedAt">;
