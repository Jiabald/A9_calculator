export type TradeReviewSide = "long" | "short";

export type TradeReviewInput = {
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

export type TradeReviewRecord = TradeReviewInput & {
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

export type PaginatedTradeReviews = {
  items: TradeReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
};
