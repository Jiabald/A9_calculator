import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Kline, MarketSummary, OrderBook, Ticker } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAxiosInstance(): AxiosInstance {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache"
  };

  const config: AxiosRequestConfig = {
    headers,
    timeout: 20000,
    timeoutErrorMessage: "请求超时，请检查网络连接"
  };

  if (proxy) {
    const agent = new HttpsProxyAgent(proxy);
    config.httpsAgent = agent;
    config.httpAgent = agent;
    config.proxy = false;
  }

  return axios.create(config);
}

function toOkxInstCandidates(symbol: string): string[] {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes("-")) {
    return normalized.endsWith("-SWAP") ? [normalized] : [normalized, `${normalized}-SWAP`];
  }

  if (normalized.endsWith("USDT")) {
    const base = normalized.slice(0, -4);
    return [`${base}-USDT`, `${base}-USDT-SWAP`];
  }

  return [`${normalized}-USDT`, `${normalized}-USDT-SWAP`];
}

function assertOkxData(responseData: any, symbol: string, instId: string) {
  const data = responseData?.data;
  if (responseData?.code !== "0" || !Array.isArray(data) || data.length === 0) {
    const message = responseData?.msg || "OKX 未返回数据";
    throw new Error(`OKX 未找到 ${symbol} 对应交易对 ${instId}: ${message}`);
  }
  return data;
}

export class BinanceService {
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;
  private readonly isOkx: boolean;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.http = createAxiosInstance();
    this.isOkx = baseUrl.includes("okx.com");
  }

  async getTicker(symbol = "BTCUSDT"): Promise<Ticker> {
    await sleep(300);

    if (this.isOkx) {
      return this.getTickerFromOkx(symbol);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v3/ticker/24hr`, {
          params: { symbol },
          timeout: 15000
        });
        const d = response.data;
        return {
          symbol: d.symbol,
          price: d.lastPrice,
          priceChange: d.priceChange,
          priceChangePercent: d.priceChangePercent,
          highPrice: d.highPrice,
          lowPrice: d.lowPrice,
          volume: d.volume,
          quoteVolume: d.quoteVolume,
          openTime: d.openTime,
          closeTime: d.closeTime
        };
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 418 || error.response?.data?.code === -1003) {
          await sleep(10_000);
        } else if (attempt < 3) {
          await sleep(2000);
        }
      }
    }
    throw new Error(`获取 ${symbol} 行情失败: ${(lastError as any)?.message || "未知错误"}`);
  }

  private async getTickerFromOkx(symbol: string): Promise<Ticker> {
    let lastError: unknown;
    for (const instId of toOkxInstCandidates(symbol)) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v5/market/ticker`, {
          params: { instId },
          timeout: 15000
        });
        const d = assertOkxData(response.data, symbol, instId)[0];
        const now = Date.now();
        const open24h = Number(d.open24h);
        const last = Number(d.last);
        const change = last - open24h;
        const changePct = ((change / open24h) * 100).toFixed(4);
        return {
          symbol,
          price: d.last,
          priceChange: change.toFixed(2),
          priceChangePercent: changePct,
          highPrice: d.high24h,
          lowPrice: d.low24h,
          volume: d.vol24h,
          quoteVolume: d.volCcy24h,
          openTime: now - 86_400_000,
          closeTime: now
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error((lastError as Error)?.message || `获取 ${symbol} OKX 行情失败`);
  }

  private async getKlinesFromOkx(symbol: string, interval: string, limit: number): Promise<Kline[]> {
    const bar = interval.replace(/([0-9]+)([a-z])/, (_m, n: string, u: string) => `${n}${u.toUpperCase()}`);
    let lastError: unknown;
    for (const instId of toOkxInstCandidates(symbol)) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v5/market/candles`, {
          params: { instId, bar, limit },
          timeout: 15000
        });
        return assertOkxData(response.data, symbol, instId)
          .reverse()
          .map((k: any[]) => ({
            openTime: Number(k[0]),
            open: k[1],
            high: k[2],
            low: k[3],
            close: k[4],
            volume: k[5],
            closeTime: Number(k[0]) + 3_600_000,
            quoteVolume: k[7],
            trades: 0
          }));
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error((lastError as Error)?.message || `获取 ${symbol} OKX K线数据失败`);
  }

  private async getOrderBookFromOkx(symbol: string, limit: number): Promise<OrderBook> {
    let lastError: unknown;
    for (const instId of toOkxInstCandidates(symbol)) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v5/market/books`, {
          params: { instId, sz: limit },
          timeout: 15000
        });
        const d = assertOkxData(response.data, symbol, instId)[0];
        return {
          bids: (d.bids || []).map((b: any[]) => [b[0], b[1]] as [string, string]),
          asks: (d.asks || []).map((a: any[]) => [a[0], a[1]] as [string, string])
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error((lastError as Error)?.message || `获取 ${symbol} OKX 订单簿数据失败`);
  }

  async getKlines(symbol = "BTCUSDT", interval = "1h", limit = 24): Promise<Kline[]> {
    await sleep(300);

    if (this.isOkx) {
      return this.getKlinesFromOkx(symbol, interval, limit);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v3/klines`, {
          params: { symbol, interval, limit },
          timeout: 15000
        });
        return (response.data as any[]).map((k: any[]) => ({
          openTime: k[0],
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          closeTime: k[6],
          quoteVolume: k[7],
          trades: k[8]
        }));
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 418 || error.response?.data?.code === -1003) {
          await sleep(10_000);
        } else if (attempt < 3) {
          await sleep(2000);
        }
      }
    }
    throw new Error(`获取 ${symbol} K线数据失败: ${(lastError as any)?.message || "未知错误"}`);
  }

  async getOrderBook(symbol = "BTCUSDT", limit = 10): Promise<OrderBook> {
    await sleep(300);

    if (this.isOkx) {
      return this.getOrderBookFromOkx(symbol, limit);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.http.get(`${this.baseUrl}/api/v3/depth`, {
          params: { symbol, limit },
          timeout: 15000
        });
        return { bids: response.data.bids, asks: response.data.asks };
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 418 || error.response?.data?.code === -1003) {
          await sleep(10_000);
        } else if (attempt < 3) {
          await sleep(2000);
        }
      }
    }
    throw new Error(`获取 ${symbol} 订单簿数据失败: ${(lastError as any)?.message || "未知错误"}`);
  }

  async getMarketSummary(symbol: string, klineInterval: string, klineLimit: number): Promise<MarketSummary> {
    const [ticker, klines, orderBook] = await Promise.all([
      this.getTicker(symbol),
      this.getKlines(symbol, klineInterval, klineLimit),
      this.getOrderBook(symbol)
    ]);

    return {
      ticker,
      klines,
      orderBook,
      timestamp: new Date().toISOString()
    };
  }
}

