import type { TradeReviewSide } from "../../types";

export const DIRECTION_OPTIONS = [
  { label: "做多 Long", value: "long" as TradeReviewSide },
  { label: "做空 Short", value: "short" as TradeReviewSide }
];

export const ENTRY_MODE_OPTIONS = [
  { label: "限价单 Limit", value: "limit" },
  { label: "市价单 Market", value: "market" },
  { label: "止损单 Stop", value: "stop" },
  { label: "条件单 Conditional", value: "conditional" }
];

export const TIMEFRAME_OPTIONS = [
  { label: "1M", value: "1M" },
  { label: "5M", value: "5M" },
  { label: "15M", value: "15M" },
  { label: "1H", value: "1H" },
  { label: "4H", value: "4H" },
  { label: "1D", value: "1D" }
];

export const MARKET_CYCLE_OPTIONS = [
  { label: "趋势 Trend", value: "trend" },
  { label: "震荡 Range", value: "range" },
  { label: "突破 Breakout", value: "breakout" },
  { label: "反转 Reversal", value: "reversal" }
];

export const TRADE_TYPE_OPTIONS = [
  { label: "日内 Day", value: "day" },
  { label: "波段 Swing", value: "swing" },
  { label: "趋势 Trend", value: "trend" },
  { label: "scalp", value: "scalp" }
];

export const MAX_SCREENSHOTS = 9;
