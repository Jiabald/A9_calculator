import type { PositionPayload, PositionRecord } from "./types";

export type AiTrend = "上涨" | "下跌" | "震荡";

export interface AiAnalysisResult {
  timestamp: string;
  currentPrice: string;
  trend: AiTrend;
  summary: string;
  keyPoints: string[];
  buyZone: { priceRange: string; reason: string; strength: "强" | "中" | "弱" };
  sellZone: { priceRange: string; reason: string; strength: "强" | "中" | "弱" };
  activeTimeAnalysis: { mostActiveHours: string; currentTimeStatus: string; suggestion: string };
  riskWarning: string;
  suggestion: string;
}

export interface AiAnalyzeResponse {
  symbol: string;
  apiBase: string;
  klineInterval: string;
  klineLimit: number;
  result: AiAnalysisResult;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "请求失败");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchPositions() {
  const response = await fetch("/api/positions");
  return parseResponse<PositionRecord[]>(response);
}

export async function fetchCurrentPrincipal() {
  const response = await fetch("/api/principal");
  return parseResponse<{ principal: number | null }>(response);
}

export async function createPosition(payload: PositionPayload) {
  const response = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PositionRecord>(response);
}

export async function updatePosition(id: string, payload: PositionPayload) {
  const response = await fetch(`/api/positions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PositionRecord>(response);
}

export type PatchPositionPayload = Partial<Omit<PositionPayload, "takeProfit" | "closePrice">> & {
  takeProfit?: number | null;
  closePrice?: number | null;
};

export async function patchPosition(id: string, payload: PatchPositionPayload) {
  const response = await fetch(`/api/positions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PositionRecord>(response);
}

export async function deletePosition(id: string) {
  const response = await fetch(`/api/positions/${id}`, { method: "DELETE" });
  return parseResponse<void>(response);
}

export async function analyzeCoin(payload: {
  symbol: string;
  apiBase?: string;
  klineInterval?: string;
  klineLimit?: number;
}) {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<AiAnalyzeResponse>(response);
}

export async function analyzeCoinStream(
  payload: {
    symbol: string;
    apiBase?: string;
    klineInterval?: string;
    klineLimit?: number;
  },
  options: {
    onChunk: (chunk: string) => void;
    signal?: AbortSignal;
  }
) {
  const finalMarker = "\n\n__A9_ANALYZE_FINAL__\n";
  const response = await fetch("/api/ai/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "请求失败");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let pendingText = "";
  let finalText = "";
  let readingFinal = false;

  function emitText(text: string) {
    if (!text) return;
    fullText += text;
    options.onChunk(text);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });

    if (readingFinal) {
      finalText += text;
      continue;
    }

    pendingText += text;
    const markerIndex = pendingText.indexOf(finalMarker);
    if (markerIndex >= 0) {
      emitText(pendingText.slice(0, markerIndex));
      finalText += pendingText.slice(markerIndex + finalMarker.length);
      pendingText = "";
      readingFinal = true;
      continue;
    }

    const safeLength = Math.max(0, pendingText.length - finalMarker.length);
    if (safeLength > 0) {
      emitText(pendingText.slice(0, safeLength));
      pendingText = pendingText.slice(safeLength);
    }
  }

  if (readingFinal) {
    finalText += decoder.decode();
  } else {
    pendingText += decoder.decode();
    emitText(pendingText);
  }

  const final = finalText.trim()
    ? ((await Promise.resolve()
        .then(() => JSON.parse(finalText.trim()) as AiAnalyzeResponse)
        .catch(() => undefined)) as AiAnalyzeResponse | undefined)
    : undefined;
  return { text: fullText, final };
}
