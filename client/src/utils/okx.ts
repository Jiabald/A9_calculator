type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T;
};

type OkxTicker = {
  instId: string;
  last: string;
};

/** 将 BTCUSDT / BTC-USDT 等转为 OKX 永续合约 instId */
export function symbolToOkxSwapInstId(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("请先输入品种");
  }

  if (normalized.endsWith("-SWAP")) {
    return normalized;
  }

  if (normalized.includes("-")) {
    return `${normalized}-SWAP`;
  }

  if (normalized.endsWith("USDT")) {
    const base = normalized.slice(0, -4);
    if (!base) {
      throw new Error("品种格式无效");
    }
    return `${base}-USDT-SWAP`;
  }

  throw new Error("无法识别品种，请使用如 BTCUSDT 或 BTC-USDT");
}

export async function fetchOKXLastPrice(symbol: string): Promise<number> {
  const instId = symbolToOkxSwapInstId(symbol);
  const url = `/okx-api/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OKX 行情请求失败 (${response.status})`);
  }

  const json = (await response.json()) as OkxResponse<OkxTicker[]>;
  if (json.code !== "0") {
    throw new Error(json.msg || `OKX 返回错误: ${json.code}`);
  }

  const last = json.data?.[0]?.last;
  const price = Number(last);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("未获取到有效价格");
  }

  return price;
}
