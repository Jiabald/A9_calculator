import { BinanceService } from "./binanceService.js";
import { DeepSeekService } from "./deepseekService.js";
import type { AnalyzeRequest, AnalyzeResponse } from "./types.js";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`缺少必要的环境变量: ${key}`);
  }
  return value;
}

function normalizeSymbol(input: string): string {
  const raw = input.trim().toUpperCase();
  if (!raw) return "BTCUSDT";
  // 支持用户输入 BTC / ETH 之类的基础币种
  if (/^[A-Z0-9]{2,10}$/.test(raw) && !raw.endsWith("USDT")) return `${raw}USDT`;
  return raw.replace("-", "");
}

export const aiAnalyzeService = {
  async analyze(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
    const symbol = normalizeSymbol(payload.symbol);

    const klineInterval = payload.klineInterval?.trim() || "1h";
    const klineLimit =
      typeof payload.klineLimit === "number" && Number.isFinite(payload.klineLimit) && payload.klineLimit > 0
        ? Math.min(Math.floor(payload.klineLimit), 500)
        : 24;

    const apiBase = payload.apiBase?.trim() || process.env.BINANCE_API_BASE || "https://api.binance.com";

    const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
    const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    const binance = new BinanceService(apiBase);
    const deepseek = new DeepSeekService(deepseekApiKey, deepseekBaseUrl, deepseekModel);

    const marketData = await binance.getMarketSummary(symbol, klineInterval, klineLimit);
    const result = await deepseek.analyze(marketData);

    return { symbol, apiBase, klineInterval, klineLimit, result };
  },
  async analyzeStream(
    payload: AnalyzeRequest,
    options: { onDelta: (delta: string) => void; signal?: AbortSignal }
  ): Promise<AnalyzeResponse> {
    const symbol = normalizeSymbol(payload.symbol);

    const klineInterval = payload.klineInterval?.trim() || "1h";
    const klineLimit =
      typeof payload.klineLimit === "number" && Number.isFinite(payload.klineLimit) && payload.klineLimit > 0
        ? Math.min(Math.floor(payload.klineLimit), 500)
        : 24;

    const apiBase = payload.apiBase?.trim() || process.env.BINANCE_API_BASE || "https://api.binance.com";

    const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
    const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    const binance = new BinanceService(apiBase);
    const deepseek = new DeepSeekService(deepseekApiKey, deepseekBaseUrl, deepseekModel);

    const marketData = await binance.getMarketSummary(symbol, klineInterval, klineLimit);
    const result = await deepseek.analyzeStream(marketData, options.onDelta, options.signal);

    return { symbol, apiBase, klineInterval, klineLimit, result };
  }
};

