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
  tradeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type PositionPayload = Omit<PositionRecord, "id" | "createdAt" | "updatedAt">;

export type PrincipalSnapshot = {
  startPrincipal: number;
  endPrincipal: number | null;
};

export type PaginatedPositionsResponse = {
  items: PositionRecord[];
  total: number;
  page: number;
  pageSize: number;
  principalChain: Record<string, PrincipalSnapshot>;
};

export type TradeReviewSide = "long" | "short";

export type TradeReviewPayload = {
  screenshots: string[];
  strategy: string;
  symbol: string;
  side: TradeReviewSide;
  entryMode: string;
  tradeDate: string;
  timeframe?: string;
  entryReason: string;
  profitTarget: string;
  initialStopLoss: string;
  reviewNotes?: string;
  profitLoss?: number;
  riskReward?: number;
  marketCycle?: string;
  tradeType?: string;
  executionConfidence?: number;
};

export type TradeReviewRecord = TradeReviewPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type TradeReviewListItem = {
  id: string;
  coverImage: string | null;
  strategy: string;
  symbol: string;
  side: TradeReviewSide;
  entryMode: string;
  tradeDate: string;
  timeframe: string | null;
  profitLoss: number | null;
  riskReward: number | null;
  executionConfidence: number | null;
  createdAt: string;
};

export type PaginatedTradeReviewsResponse = {
  items: TradeReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
};
