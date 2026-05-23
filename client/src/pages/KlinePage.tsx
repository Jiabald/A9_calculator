import { useEffect, useRef, useState } from "react";
import { DateRangePicker, MessagePlugin, Select } from "tdesign-react";
import type { DateRangeValue, SelectValue } from "tdesign-react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi, MouseEventHandler, Time, UTCTimestamp } from "lightweight-charts";

const MAX_DAYS = 7;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DayStats {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "3m", desc: "3 分钟", value: "3m" },
  { label: "5m", desc: "5 分钟", value: "5m" },
  { label: "15m", desc: "15 分钟", value: "15m" },
  { label: "1H", desc: "1 小时", value: "1H" },
  { label: "2H", desc: "2 小时", value: "2H" },
  { label: "4H", desc: "4 小时", value: "4H" },
];

const SYMBOL_OPTIONS = [
  { label: "BTC-USDT", value: "BTC-USDT" },
  { label: "ETH-USDT", value: "ETH-USDT" },
  { label: "SOL-USDT", value: "SOL-USDT" },
  { label: "BNB-USDT", value: "BNB-USDT" },
  { label: "XRP-USDT", value: "XRP-USDT" },
  { label: "DOGE-USDT", value: "DOGE-USDT" },
  { label: "ADA-USDT", value: "ADA-USDT" },
  { label: "AVAX-USDT", value: "AVAX-USDT" },
  { label: "DOT-USDT", value: "DOT-USDT" },
  { label: "LINK-USDT", value: "LINK-USDT" },
];

// ─── OKX API ─────────────────────────────────────────────────────────────────

async function fetchOKXCandles(
  instId: string,
  bar: string,
  startDate: string,
  endDate: string
): Promise<CandleData[]> {
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

  const results: CandleData[] = [];
  let afterTs = endMs;

  // 7 days of 3m candles = ~3360 rows → at most 34 pages of 100; cap at 50
  for (let page = 0; page < 50; page++) {
    const url = `/okx-api/api/v5/market/history-candles?instId=${encodeURIComponent(instId)}&bar=${bar}&after=${afterTs}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OKX API 请求失败 (${res.status})`);

    const json = (await res.json()) as { code: string; msg: string; data: string[][] };
    if (json.code !== "0") throw new Error(json.msg || `OKX API 错误: ${json.code}`);
    if (!json.data || json.data.length === 0) break;

    let reachedStart = false;
    for (const row of json.data) {
      const ts = Number(row[0]);
      if (ts < startMs) { reachedStart = true; break; }
      if (ts < endMs) {
        results.push({
          time: Math.floor(ts / 1000) as UTCTimestamp,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        });
      }
    }

    if (reachedStart) break;
    const oldestTs = Number(json.data[json.data.length - 1][0]);
    if (oldestTs <= startMs) break;
    afterTs = oldestTs;
  }

  return results.sort((a, b) => (a.time as number) - (b.time as number));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Difference in whole days: end - start (can be negative) */
function dayDiff(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000);
}

function dateRangeLabel(start: string, end: string) {
  return start === end ? start : `${start} ~ ${end}`;
}

/** Return YYYY-MM-DD for today + offsetDays (negative = past) */
function offsetDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function formatPrice(n: number) {
  if (n >= 10000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatVolume(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatCandleTime(time: UTCTimestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Number(time) * 1000));
}

function isCandlestickData(data: unknown): data is { open: number; high: number; low: number; close: number } {
  return (
    typeof data === "object" &&
    data !== null &&
    "open" in data &&
    "high" in data &&
    "low" in data &&
    "close" in data
  );
}

function calcDayStats(candles: CandleData[]): DayStats {
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const volume = candles.reduce((s, c) => s + c.volume, 0);
  const change = close - open;
  const changePercent = (change / open) * 100;
  return { open, high, low, close, volume, change, changePercent };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KlinePage() {
  const [symbol, setSymbol] = useState<string>("BTC-USDT");
  const [startDate, setStartDate] = useState<string>(todayStr());
  const [endDate, setEndDate] = useState<string>(todayStr());
  const [period, setPeriod] = useState<string>("");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const candlesRef = useRef<CandleData[]>([]);

  // Derived validation
  const diff = startDate && endDate ? dayDiff(startDate, endDate) : 0;
  const dateValid = !!(startDate && endDate && diff >= 0 && diff <= MAX_DAYS - 1);
  const rangeDays = dateValid ? diff + 1 : 0;

  // Presets for DateRangePicker (cast avoids TDesign internal PresetRange mismatch)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const datePresets: any = {
    今天: [todayStr(), todayStr()],
    近3天: [offsetDate(-2), todayStr()],
    近5天: [offsetDate(-4), todayStr()],
    近7天: [offsetDate(-6), todayStr()],
  };

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#172033",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#eef3f8" },
        horzLines: { color: "#eef3f8" },
      },
      rightPriceScale: {
        borderColor: "#d8e0ea",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "#d8e0ea",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#2457e6", labelBackgroundColor: "#2457e6" },
        horzLine: { color: "#2457e6", labelBackgroundColor: "#2457e6" },
      },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onCrosshairMove: MouseEventHandler<Time> = (param) => {
      if (!param.point || typeof param.time !== "number") {
        setHoveredCandle(null);
        return;
      }

      const bar = param.seriesData.get(series);
      if (!isCandlestickData(bar)) {
        setHoveredCandle(null);
        return;
      }

      const time = param.time as UTCTimestamp;
      const volume = candlesRef.current.find((c) => c.time === time)?.volume ?? 0;
      setHoveredCandle({
        time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    candlesRef.current = candles;
    if (candles.length === 0) {
      setHoveredCandle(null);
    }
  }, [candles]);

  // Update chart data when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  function clearData() {
    setPeriod("");
    setCandles([]);
    setHoveredCandle(null);
  }

  function handleSymbolChange(v: SelectValue) {
    setSymbol(String(v));
    clearData();
  }

  function handleRangeChange(value: DateRangeValue) {
    const [s, e] = value as string[];
    // onChange fires when both sides are filled; guard partial selections
    if (!s || !e) return;
    const d = dayDiff(s, e);
    if (d < 0) {
      void MessagePlugin.warning("结束日期不能早于开始日期");
      return;
    }
    if (d > MAX_DAYS - 1) {
      void MessagePlugin.warning(`日期范围最多 ${MAX_DAYS} 天，请重新选择`);
      return;
    }
    setStartDate(s);
    setEndDate(e);
    clearData();
  }

  async function handlePeriodClick(p: string) {
    if (!dateValid) {
      void MessagePlugin.warning("请先选择有效的日期范围（最多 7 天）");
      return;
    }
    setPeriod(p);
    setLoading(true);
    setCandles([]);
    try {
      const data = await fetchOKXCandles(symbol, p, startDate, endDate);
      if (data.length === 0) {
        void MessagePlugin.warning("该日期范围暂无数据，请尝试其他日期或品种");
      } else {
        setCandles(data);
      }
    } catch (e) {
      void MessagePlugin.error(e instanceof Error ? e.message : "获取失败，请检查网络");
      setPeriod("");
    } finally {
      setLoading(false);
    }
  }

  const stats = candles.length > 0 ? calcDayStats(candles) : null;
  const periodDesc = PERIOD_OPTIONS.find((p) => p.value === period)?.desc ?? "";
  const hasFetched = candles.length > 0;
  const rangeLabel = startDate && endDate ? dateRangeLabel(startDate, endDate) : "";

  return (
    <div>
      {/* Page header */}
      <div className="hero-compact" style={{ marginBottom: 24 }}>
        <p className="eyebrow">OKX 行情</p>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", marginBottom: 8 }}>K 线查询</h1>
        <p className="hero-text" style={{ fontSize: 14 }}>
          选择品种与日期范围（最多 {MAX_DAYS} 天），点击时间周期自动加载 K 线
        </p>
      </div>

      {/* Query controls */}
      <div className="panel" style={{ marginBottom: 20 }}>
        {/* Symbol + Date range row */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-start" }}>
          {/* Symbol */}
          <div style={{ flex: "1 1 180px", minWidth: 150 }}>
            <label className="field-label">交易品种</label>
            <Select
              value={symbol}
              options={SYMBOL_OPTIONS}
              onChange={handleSymbolChange}
              style={{ width: "100%" }}
              placeholder="选择品种"
            />
          </div>

          {/* Date range */}
          <div style={{ flex: "2 1 360px", minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>日期范围</label>
              {dateValid && rangeDays > 0 && (
                <span style={{ fontSize: 12, color: "#2457e6", fontWeight: 600 }}>共 {rangeDays} 天</span>
              )}
            </div>
            <DateRangePicker
              value={[startDate, endDate]}
              onChange={handleRangeChange}
              presets={datePresets}
              disableDate={(date) => (date as unknown as { valueOf(): number }).valueOf() > Date.now()}
              placeholder={["开始日期", "结束日期"]}
              style={{ width: "400px" }}
              allowInput
              clearable
            />
          </div>
        </div>

        {/* Period tabs */}
        <div>
          <label className="field-label" style={{ marginBottom: 10 }}>时间周期</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = period === opt.value;
              const isLoading = loading && period === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => void handlePeriodClick(opt.value)}
                  disabled={loading || !dateValid}
                  className={`kline-period-btn${isActive ? " active" : ""}`}
                >
                  {isLoading && <span className="kline-period-spinner" />}
                  <span>{opt.label}</span>
                  <span className="kline-period-desc">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      {hasFetched && stats && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{symbol}</span>
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#eef3f8",
                color: "#526072",
                fontWeight: 600,
              }}
            >
              {periodDesc} · {rangeLabel}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontWeight: 700,
                fontSize: 16,
                color: stats.changePercent >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              {stats.changePercent >= 0 ? "+" : ""}
              {stats.changePercent.toFixed(2)}%
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
            {(
              [
                { label: "开盘", value: formatPrice(stats.open), color: undefined },
                { label: "最高", value: formatPrice(stats.high), color: "#22c55e" },
                { label: "最低", value: formatPrice(stats.low), color: "#ef4444" },
                { label: "收盘", value: formatPrice(stats.close), color: stats.change >= 0 ? "#22c55e" : "#ef4444" },
                { label: "振幅", value: `${(((stats.high - stats.low) / stats.open) * 100).toFixed(2)}%`, color: undefined },
                { label: "成交量", value: formatVolume(stats.volume), color: undefined },
                { label: "K线数量", value: String(candles.length), color: undefined },
              ] as const
            ).map((item) => (
              <div
                key={item.label}
                style={{
                  background: "#f8fafc",
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid rgba(97,118,145,0.1)",
                }}
              >
                <div style={{ fontSize: 11, color: "#7c8798", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color ?? "#172033" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart panel */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div
          className="panel-heading"
          style={{ marginBottom: 0, paddingBottom: 14, borderBottom: "1px solid rgba(97,118,145,0.12)" }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#526072" }}>
            {hasFetched ? `${symbol} · ${periodDesc} · ${rangeLabel}` : "K 线图"}
          </h2>
          {hasFetched && (
            <span style={{ fontSize: 12, color: "#7c8798" }}>共 {candles.length} 根 K 线（UTC 时区）</span>
          )}
        </div>

        {!hasFetched && (
          <div
            style={{
              height: 460,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#7c8798",
              gap: 12,
            }}
          >
            {loading ? (
              <>
                <div className="kline-chart-spinner" />
                <p style={{ margin: 0, fontSize: 14 }}>正在加载 K 线数据…</p>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="6" y="28" width="8" height="14" rx="2" fill="#d8e0ea" />
                  <rect x="20" y="18" width="8" height="24" rx="2" fill="#d8e0ea" />
                  <rect x="34" y="10" width="8" height="32" rx="2" fill="#d8e0ea" />
                  <line x1="10" y1="22" x2="10" y2="28" stroke="#d8e0ea" strokeWidth="2" />
                  <line x1="24" y1="12" x2="24" y2="18" stroke="#d8e0ea" strokeWidth="2" />
                  <line x1="38" y1="6" x2="38" y2="10" stroke="#d8e0ea" strokeWidth="2" />
                  <line x1="10" y1="42" x2="10" y2="46" stroke="#d8e0ea" strokeWidth="2" />
                  <line x1="24" y1="42" x2="24" y2="46" stroke="#d8e0ea" strokeWidth="2" />
                  <line x1="38" y1="42" x2="38" y2="46" stroke="#d8e0ea" strokeWidth="2" />
                </svg>
                <p style={{ margin: 0, fontSize: 14 }}>
                  选择日期范围后，点击上方时间周期按钮加载
                </p>
              </>
            )}
          </div>
        )}

        <div className="kline-chart-wrap" style={{ display: hasFetched ? "block" : "none" }}>
          {hoveredCandle && (
            <div className="kline-ohlc-bar" aria-live="polite">
              <span className="kline-ohlc-time">{formatCandleTime(hoveredCandle.time)} UTC</span>
              <span className="kline-ohlc-item">
                <span className="kline-ohlc-label">开</span>
                <span className="kline-ohlc-value">{formatPrice(hoveredCandle.open)}</span>
              </span>
              <span className="kline-ohlc-item">
                <span className="kline-ohlc-label">高</span>
                <span className="kline-ohlc-value kline-ohlc-up">{formatPrice(hoveredCandle.high)}</span>
              </span>
              <span className="kline-ohlc-item">
                <span className="kline-ohlc-label">低</span>
                <span className="kline-ohlc-value kline-ohlc-down">{formatPrice(hoveredCandle.low)}</span>
              </span>
              <span className="kline-ohlc-item">
                <span className="kline-ohlc-label">收</span>
                <span
                  className={`kline-ohlc-value ${hoveredCandle.close >= hoveredCandle.open ? "kline-ohlc-up" : "kline-ohlc-down"}`}
                >
                  {formatPrice(hoveredCandle.close)}
                </span>
              </span>
              {hoveredCandle.volume > 0 && (
                <span className="kline-ohlc-item">
                  <span className="kline-ohlc-label">量</span>
                  <span className="kline-ohlc-value">{formatVolume(hoveredCandle.volume)}</span>
                </span>
              )}
            </div>
          )}
          <div ref={containerRef} className="kline-chart-canvas" />
        </div>
      </div>
    </div>
  );
}
