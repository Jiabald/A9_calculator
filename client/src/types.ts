export type TradeSide = "long" | "short";

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
  closePrice?: number;
  notes?: string;
  tradeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type PositionPayload = Omit<PositionRecord, "id" | "createdAt" | "updatedAt">;
