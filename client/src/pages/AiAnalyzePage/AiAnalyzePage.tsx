import { Button, Input, InputNumber, Select } from "tdesign-react";
import type { InputNumberValue, SelectValue } from "tdesign-react";
import { useMemo, useRef, useState } from "react";
import { analyzeCoin, analyzeCoinStream, type AiAnalysisResult, type AiAnalyzeResponse } from "../../api";

const API_BASE_OPTIONS = [
  { label: "Binance（默认）", value: "binance" },
  { label: "OKX（用 OKX 行情接口适配）", value: "okx" },
  { label: "自定义 API_BASE", value: "custom" }
] as const;

const KLINE_INTERVAL_OPTIONS = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" }
];

type ApiBaseMode = (typeof API_BASE_OPTIONS)[number]["value"];
type StreamAnalysisResult = Omit<Partial<AiAnalysisResult>, "buyZone" | "sellZone" | "activeTimeAnalysis"> & {
  buyZone?: Partial<AiAnalysisResult["buyZone"]>;
  sellZone?: Partial<AiAnalysisResult["sellZone"]>;
  activeTimeAnalysis?: Partial<AiAnalysisResult["activeTimeAnalysis"]>;
};
type ResultMeta = Pick<AiAnalyzeResponse, "symbol" | "apiBase" | "klineInterval" | "klineLimit">;

function normalizeSymbolInput(symbol: string) {
  const s = symbol.trim().toUpperCase();
  if (!s) return "";
  if (/^[A-Z0-9]{2,10}$/.test(s) && !s.endsWith("USDT")) return `${s}USDT`;
  return s.replace("-", "");
}

function strengthTone(strength: string) {
  if (strength === "强") return { text: "强", color: "#ef4444" };
  if (strength === "中") return { text: "中", color: "#f59e0b" };
  return { text: "弱", color: "#22c55e" };
}

function parseJsonish(text: string): unknown | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let jsonStr = jsonMatch[0]
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    jsonStr = jsonStr
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\\n")
      .replace(/\\r/g, "\\r")
      .replace(/\\t/g, "\\t")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, p1: string) => String.fromCharCode(parseInt(p1, 16)))
      .replace(/,([\s]*[}\]])/g, "$1")
      .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

function readStringField(source: string, field: string) {
  const fieldMatch = new RegExp(`"${field}"\\s*:`).exec(source);
  if (!fieldMatch) return undefined;

  const afterColon = source.slice(fieldMatch.index + fieldMatch[0].length).trimStart();
  if (!afterColon.startsWith('"')) return undefined;

  let value = "";
  let escaped = false;
  for (let i = 1; i < afterColon.length; i++) {
    const char = afterColon[i];
    if (escaped) {
      value += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return decodeJsonString(value).trim();
    }
    value += char;
  }

  return decodeJsonString(value).trim();
}

function readObjectSection(source: string, field: string) {
  const fieldMatch = new RegExp(`"${field}"\\s*:`).exec(source);
  if (!fieldMatch) return "";

  const objectStart = source.indexOf("{", fieldMatch.index + fieldMatch[0].length);
  if (objectStart < 0) return "";
  return source.slice(objectStart);
}

function readStringArrayField(source: string, field: string) {
  const fieldMatch = new RegExp(`"${field}"\\s*:`).exec(source);
  if (!fieldMatch) return [];

  const arrayStart = source.indexOf("[", fieldMatch.index + fieldMatch[0].length);
  if (arrayStart < 0) return [];

  const arrayEnd = source.indexOf("]", arrayStart);
  const arrayBody = source.slice(arrayStart + 1, arrayEnd >= 0 ? arrayEnd : undefined);
  const values: string[] = [];
  let i = 0;

  while (i < arrayBody.length) {
    if (arrayBody[i] !== '"') {
      i += 1;
      continue;
    }

    let value = "";
    let escaped = false;
    i += 1;
    for (; i < arrayBody.length; i++) {
      const char = arrayBody[i];
      if (escaped) {
        value += `\\${char}`;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        break;
      }
      value += char;
    }
    if (value.trim()) values.push(decodeJsonString(value).trim());
    i += 1;
  }

  return values;
}

function extractPartialAnalysis(text: string): StreamAnalysisResult | null {
  const parsed = parseJsonish(text);
  if (parsed && typeof parsed === "object") {
    return parsed as StreamAnalysisResult;
  }

  const buyZone = readObjectSection(text, "buyZone");
  const sellZone = readObjectSection(text, "sellZone");
  const activeTimeAnalysis = readObjectSection(text, "activeTimeAnalysis");
  const partial: StreamAnalysisResult = {
    trend: readStringField(text, "trend") as AiAnalysisResult["trend"] | undefined,
    summary: readStringField(text, "summary"),
    keyPoints: readStringArrayField(text, "keyPoints"),
    buyZone: {
      priceRange: readStringField(buyZone, "priceRange"),
      reason: readStringField(buyZone, "reason"),
      strength: readStringField(buyZone, "strength") as AiAnalysisResult["buyZone"]["strength"] | undefined
    },
    sellZone: {
      priceRange: readStringField(sellZone, "priceRange"),
      reason: readStringField(sellZone, "reason"),
      strength: readStringField(sellZone, "strength") as AiAnalysisResult["sellZone"]["strength"] | undefined
    },
    activeTimeAnalysis: {
      mostActiveHours: readStringField(activeTimeAnalysis, "mostActiveHours"),
      currentTimeStatus: readStringField(activeTimeAnalysis, "currentTimeStatus"),
      suggestion: readStringField(activeTimeAnalysis, "suggestion")
    },
    riskWarning: readStringField(text, "riskWarning"),
    suggestion: readStringField(text, "suggestion")
  };

  const hasContent =
    partial.trend ||
    partial.summary ||
    partial.keyPoints?.length ||
    partial.buyZone?.priceRange ||
    partial.sellZone?.priceRange ||
    partial.activeTimeAnalysis?.mostActiveHours ||
    partial.riskWarning ||
    partial.suggestion;

  return hasContent ? partial : null;
}

function hasCompleteAnalysis(result: StreamAnalysisResult | AiAnalysisResult | null | undefined) {
  if (!result) return false;

  return Boolean(
    result.summary &&
      result.keyPoints?.length &&
      result.buyZone?.priceRange &&
      result.buyZone?.reason &&
      result.sellZone?.priceRange &&
      result.sellZone?.reason &&
      result.activeTimeAnalysis?.mostActiveHours &&
      result.activeTimeAnalysis?.currentTimeStatus &&
      result.activeTimeAnalysis?.suggestion &&
      result.riskWarning &&
      result.suggestion
  );
}

export default function AiAnalyzePage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [klineInterval, setKlineInterval] = useState("1h");
  const [klineLimit, setKlineLimit] = useState<number>(24);
  const [apiBaseMode, setApiBaseMode] = useState<ApiBaseMode>("binance");
  const [customApiBase, setCustomApiBase] = useState("https://api.binance.com");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [data, setData] = useState<AiAnalyzeResponse | null>(null);
  const [partialResult, setPartialResult] = useState<StreamAnalysisResult | null>(null);
  const [streamMeta, setStreamMeta] = useState<ResultMeta | null>(null);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef("");

  const apiBase = useMemo(() => {
    if (apiBaseMode === "okx") return "https://www.okx.com";
    if (apiBaseMode === "custom") return customApiBase.trim();
    return "https://api.binance.com";
  }, [apiBaseMode, customApiBase]);

  async function handleAnalyze() {
    const normalized = normalizeSymbolInput(symbol);
    if (!normalized) {
      setStatus("请先输入币种（例如 BTCUSDT 或 BTC）");
      return;
    }

    if (apiBaseMode === "custom" && !apiBase) {
      setStatus("自定义 API_BASE 不能为空");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const meta = {
      symbol: normalized,
      apiBase: apiBase || "https://api.binance.com",
      klineInterval,
      klineLimit
    };
    streamBufferRef.current = "";
    const payload = {
      symbol: normalized,
      apiBase: apiBase || undefined,
      klineInterval,
      klineLimit
    };

    setLoading(true);
    setStatus("正在生成分析结果，卡片会实时更新…");
    setData(null);
    setPartialResult(null);
    setStreamMeta(meta);
    setStreamText("");
    try {
      const streamResult = await analyzeCoinStream(
        payload,
        {
          signal: abortRef.current.signal,
          onChunk: (chunk) => {
            streamBufferRef.current += chunk;
            setStreamText(streamBufferRef.current);
            try {
              const nextPartial = extractPartialAnalysis(streamBufferRef.current);
              if (nextPartial) setPartialResult(nextPartial);
            } catch {
              // 流式 JSON 在生成过程中经常是半截，解析失败时继续等待后续 chunk。
            }
          }
        }
      );

      if (streamResult.final) {
        setData(streamResult.final);
        setPartialResult(streamResult.final.result);
        if (hasCompleteAnalysis(streamResult.final.result)) {
          setStatus("分析完成");
          return;
        }
      }

      const parsed = parseJsonish(streamResult.text);
      const parsedData = parsed
        ? ({
          ...meta,
          result: parsed as any
        } as AiAnalyzeResponse)
        : null;

      if (parsedData && hasCompleteAnalysis(parsedData.result)) {
        setData(parsedData);
        setPartialResult(parsedData.result);
        setStatus("分析完成");
      } else {
        if (parsedData) {
          setData(parsedData);
          setPartialResult(parsedData.result);
        }
        setStatus("正在补齐完整分析结果…");
        const fallback = await analyzeCoin(payload);
        setData(fallback);
        setPartialResult(fallback.result);
        setStatus("分析完成");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("已取消");
      } else {
        setStatus(error instanceof Error ? error.message : "分析失败");
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleResult = data?.result ?? partialResult;
  const visibleMeta = data ?? streamMeta;
  const streamError = streamText.includes("[ERROR]");
  const emptyText = loading ? "生成中…" : "未返回";

  const trendChip = useMemo(() => {
    const trend = visibleResult?.trend;
    if (!trend) return null;
    const color = trend === "上涨" ? "#22c55e" : trend === "下跌" ? "#ef4444" : "#64748b";
    return { trend, color };
  }, [visibleResult?.trend]);

  return (
    <div>
      <section className="hero hero-compact">
        <div className="hero-text-wrap">
          <p className="eyebrow">AI</p>
          <h1>AI 行情分析</h1>
          <p className="hero-text">从交易所拉取行情数据，并调用 DeepSeek 输出结构化分析（支持自定义币种与切换 API_BASE）。</p>
        </div>
      </section>

      <section className="calc-layout-vertical">
        <div className="panel form-panel">
          <div className="form-section-title">
            <span className="section-title-text">参数</span>
          </div>

          <div className="form-grid-account">
            <label className="td-label">
              币种（USDT 永续）
              <Input value={symbol} placeholder="例：BTCUSDT 或 BTC" onChange={(v: string) => setSymbol(v)} />
            </label>

            <label className="td-label">
              K 线周期
              <Select
                value={klineInterval}
                options={KLINE_INTERVAL_OPTIONS}
                onChange={(v: SelectValue) => setKlineInterval(String(v))}
              />
            </label>

            <label className="td-label">
              K 线数量
              <InputNumber
                value={klineLimit}
                min={10}
                max={500}
                step={1}
                decimalPlaces={0}
                theme="normal"
                style={{ width: "100%" }}
                onChange={(v: InputNumberValue) => {
                  const n = typeof v === "number" ? v : 24;
                  setKlineLimit(Number.isFinite(n) ? n : 24);
                }}
              />
            </label>
          </div>

          <div className="form-section-title" style={{ marginTop: 18 }}>
            <span className="section-title-text">API_BASE</span>
          </div>

          <div className="form-grid-2">
            <label className="td-label">
              数据源
              <Select
                value={apiBaseMode}
                options={API_BASE_OPTIONS as unknown as { label: string; value: string }[]}
                onChange={(v: SelectValue) => setApiBaseMode(v as ApiBaseMode)}
              />
            </label>

            <label className="td-label">
              {apiBaseMode === "custom" ? "自定义 API_BASE" : "当前 API_BASE"}
              <Input
                value={apiBaseMode === "custom" ? customApiBase : apiBase}
                disabled={apiBaseMode !== "custom"}
                placeholder="例：https://api.binance.com 或 https://www.okx.com"
                onChange={(v: string) => setCustomApiBase(v)}
              />
            </label>
          </div>

          <div className="button-row" style={{ marginTop: 16 }}>
            <Button theme="primary" size="large" block loading={loading} onClick={() => void handleAnalyze()}>
              开始分析
            </Button>
          </div>

          {status && <p className="status">{status}</p>}
        </div>

        <aside className="panel result-panel non-sticky">
          <div className="result-header">
            <h2>分析结果</h2>
            {trendChip && (
              <span className="result-chip" style={{ background: `${trendChip.color}1A`, color: trendChip.color }}>
                {trendChip.trend}
              </span>
            )}
          </div>

          {!streamText && !visibleResult && (
            <div className="result-empty">
              <div className="result-empty-icon">AI</div>
              <p className="hint">填写参数后点击「开始分析」</p>
              <p className="hint-sub">结果会以结构化方式展示在这里</p>
            </div>
          )}

          {loading && (
            <div className="panel" style={{ padding: 14, marginTop: 12, background: "#eef3ff", border: "1px solid rgba(36,87,230,0.18)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 900, color: "#2457e6" }}>AI 正在生成，卡片内容会实时补齐</div>
                <Button
                  theme="default"
                  variant="outline"
                  size="small"
                  onClick={() => abortRef.current?.abort()}
                >
                  取消
                </Button>
              </div>
              <div style={{ color: "#526072", fontSize: 13, lineHeight: 1.6 }}>
                已接收 {streamText.length} 个字符，正在解析摘要、关键要点和交易区间。
              </div>
            </div>
          )}

          {streamError && (
            <div className="panel" style={{ padding: 14, marginTop: 12, background: "#fff0f1", border: "1px solid rgba(201,29,50,0.2)" }}>
              <div style={{ fontWeight: 900, color: "#c91d32", marginBottom: 8 }}>流式输出错误</div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#9f1239",
                  lineHeight: 1.65,
                  fontSize: 12
                }}
              >
                {streamText}
              </pre>
            </div>
          )}

          {visibleResult && visibleMeta && (
            <div className="metric-list">
              <div className="metric metric-highlight">
                <span>币种</span>
                <strong>{visibleMeta.symbol}</strong>
              </div>
              <div className="metric">
                <span>API_BASE</span>
                <strong style={{ fontSize: 12 }}>{visibleMeta.apiBase}</strong>
              </div>
              <div className="metric metric-highlight">
                <span>当前价格</span>
                <strong>{visibleResult.currentPrice ? `$${Number(visibleResult.currentPrice).toLocaleString()}` : emptyText}</strong>
              </div>

              <div className="panel" style={{ padding: 14, marginTop: 12, background: "#f8fafc" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>摘要</div>
                <div style={{ color: "#526072", lineHeight: 1.6 }}>{visibleResult.summary || emptyText}</div>
              </div>

              <div className="panel" style={{ padding: 14, marginTop: 12, background: "#f8fafc" }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>关键要点</div>
                {visibleResult.keyPoints?.length ? (
                  <ol style={{ margin: 0, paddingLeft: 18, color: "#172033" }}>
                    {visibleResult.keyPoints.map((k, idx) => (
                      <li key={idx} style={{ marginBottom: 6, color: "#526072" }}>
                        {k}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ color: "#7c8798" }}>{emptyText}</div>
                )}
              </div>

              {(() => {
                const buyTone = strengthTone(visibleResult.buyZone?.strength || "弱");
                const sellTone = strengthTone(visibleResult.sellZone?.strength || "弱");
                return (
                  <div className="panel" style={{ padding: 14, marginTop: 12, background: "#f8fafc" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ border: "1px solid rgba(97,118,145,0.12)", borderRadius: 12, padding: 12, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <strong>买入区间</strong>
                          <span style={{ fontSize: 12, fontWeight: 800, color: buyTone.color }}>强度：{buyTone.text}</span>
                        </div>
                        <div style={{ color: "#172033", fontWeight: 700, marginBottom: 6 }}>{visibleResult.buyZone?.priceRange || emptyText}</div>
                        <div style={{ color: "#526072", lineHeight: 1.6 }}>{visibleResult.buyZone?.reason || emptyText}</div>
                      </div>

                      <div style={{ border: "1px solid rgba(97,118,145,0.12)", borderRadius: 12, padding: 12, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <strong>卖出/止盈区间</strong>
                          <span style={{ fontSize: 12, fontWeight: 800, color: sellTone.color }}>强度：{sellTone.text}</span>
                        </div>
                        <div style={{ color: "#172033", fontWeight: 700, marginBottom: 6 }}>{visibleResult.sellZone?.priceRange || emptyText}</div>
                        <div style={{ color: "#526072", lineHeight: 1.6 }}>{visibleResult.sellZone?.reason || emptyText}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="panel" style={{ padding: 14, marginTop: 12, background: "#f8fafc" }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>资金活跃时段</div>
                <div style={{ color: "#526072", lineHeight: 1.7 }}>
                  <div>
                    <strong style={{ color: "#172033" }}>最活跃</strong>：{visibleResult.activeTimeAnalysis?.mostActiveHours || emptyText}
                  </div>
                  <div>
                    <strong style={{ color: "#172033" }}>当前时段</strong>：{visibleResult.activeTimeAnalysis?.currentTimeStatus || emptyText}
                  </div>
                  <div>
                    <strong style={{ color: "#172033" }}>建议</strong>：{visibleResult.activeTimeAnalysis?.suggestion || emptyText}
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 14, marginTop: 12, background: "#fff7ed", border: "1px solid rgba(245,158,11,0.25)" }}>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>风险提示</div>
                <div style={{ color: "#9a3412", lineHeight: 1.6 }}>{visibleResult.riskWarning || emptyText}</div>
              </div>

              <div className="panel" style={{ padding: 14, marginTop: 12, background: "#eef3f8" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>综合建议</div>
                <div style={{ color: "#526072", lineHeight: 1.6 }}>{visibleResult.suggestion || emptyText}</div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

