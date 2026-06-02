export interface Ticker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

export interface OrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

export interface MarketSummary {
  ticker: Ticker;
  klines: Kline[];
  orderBook: OrderBook;
  timestamp: string;
}

export interface AnalysisResult {
  timestamp: string;
  currentPrice: string;
  trend: "上涨" | "下跌" | "震荡";
  summary: string;
  keyPoints: string[];
  buyZone: {
    priceRange: string;
    reason: string;
    strength: "强" | "中" | "弱";
  };
  sellZone: {
    priceRange: string;
    reason: string;
    strength: "强" | "中" | "弱";
  };
  activeTimeAnalysis: {
    mostActiveHours: string;
    currentTimeStatus: string;
    suggestion: string;
  };
  riskWarning: string;
  suggestion: string;
}

export interface AnalyzeRequest {
  symbol: string;
  klineInterval?: string;
  klineLimit?: number;
  apiBase?: string;
}

export interface AnalyzeResponse {
  symbol: string;
  apiBase: string;
  klineInterval: string;
  klineLimit: number;
  result: AnalysisResult;
}

