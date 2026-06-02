import OpenAI from "openai";
import type { AnalysisResult, MarketSummary } from "./types.js";

export class DeepSeekService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  private analyzeMarketStructure(highs: number[], lows: number[]) {
    const recentHighs = highs.slice(-20);
    const recentLows = lows.slice(-20);

    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = 1; i < recentHighs.length - 1; i++) {
      if (recentHighs[i] > recentHighs[i - 1] && recentHighs[i] > recentHighs[i + 1]) {
        swingHighs.push(recentHighs[i]);
      }
      if (recentLows[i] < recentLows[i - 1] && recentLows[i] < recentLows[i + 1]) {
        swingLows.push(recentLows[i]);
      }
    }

    let structure = "震荡";
    let trendDirection = "中性";
    let structurePattern = "未识别";

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastSwingHigh = swingHighs[swingHighs.length - 1];
      const prevSwingHigh = swingHighs[swingHighs.length - 2];
      const lastSwingLow = swingLows[swingLows.length - 1];
      const prevSwingLow = swingLows[swingLows.length - 2];

      if (lastSwingHigh > prevSwingHigh && lastSwingLow > prevSwingLow) {
        structure = "上升趋势（HH+HL）";
        trendDirection = "多头";
        structurePattern = "HH+HL";
      } else if (lastSwingHigh < prevSwingHigh && lastSwingLow < prevSwingLow) {
        structure = "下降趋势（LL+LH）";
        trendDirection = "空头";
        structurePattern = "LL+LH";
      } else if (lastSwingHigh > prevSwingHigh && lastSwingLow < prevSwingLow) {
        structure = "扩张/背离";
        trendDirection = "波动加剧";
        structurePattern = "HH+LL";
      } else if (lastSwingHigh < prevSwingHigh && lastSwingLow > prevSwingLow) {
        structure = "收缩/盘整";
        trendDirection = "收敛";
        structurePattern = "LH+HL";
      }
    }

    const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : highs[highs.length - 1];
    const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : lows[lows.length - 1];

    return {
      structure,
      trendDirection,
      structurePattern,
      swingHighsCount: swingHighs.length,
      swingLowsCount: swingLows.length,
      lastSwingHigh: lastHigh.toFixed(2),
      lastSwingLow: lastLow.toFixed(2),
      swingHighs: swingHighs.slice(-3).map((h) => h.toFixed(2)),
      swingLows: swingLows.slice(-3).map((l) => l.toFixed(2))
    };
  }

  private calcIndicators(klines: MarketSummary["klines"]) {
    const closes = klines.map((k) => Number(k.close));
    const highs = klines.map((k) => Number(k.high));
    const lows = klines.map((k) => Number(k.low));
    const vols = klines.map((k) => Number(k.volume));
    const n = closes.length;

    const ema = (arr: number[], period: number): number[] => {
      const k = 2 / (period + 1);
      const result: number[] = [arr[0]];
      for (let i = 1; i < arr.length; i++) {
        result.push(arr[i] * k + result[i - 1] * (1 - k));
      }
      return result;
    };

    const ema20Arr = ema(closes, 20);
    const ema30Arr = ema(closes, 30);
    const ema20 = ema20Arr[ema20Arr.length - 1];
    const ema30 = ema30Arr[ema30Arr.length - 1];

    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const dif = ema12.map((v, i) => v - ema26[i]);
    const dea = ema(dif, 9);
    const macd = dif[dif.length - 1] - dea[dea.length - 1];

    const rsiPeriod = 14;
    let gains = 0;
    let losses = 0;
    for (let i = n - rsiPeriod; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 1);
    const rsi = 100 - 100 / (1 + rs);

    const bbPeriod = Math.min(20, n);
    const bbSlice = closes.slice(-bbPeriod);
    const bbMid = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbStd = Math.sqrt(bbSlice.reduce((a, b) => a + (b - bbMid) ** 2, 0) / bbPeriod);
    const bbUpper = bbMid + 2 * bbStd;
    const bbLower = bbMid - 2 * bbStd;

    const recentLows = lows.slice(-24);
    const recentHighs = highs.slice(-24);
    const supportLevel = Math.min(...recentLows);
    const resistLevel = Math.max(...recentHighs);
    const sortedLows = [...recentLows].sort((a, b) => a - b);
    const sortedHighs = [...recentHighs].sort((a, b) => b - a);
    const support2 = sortedLows.slice(1, 4).reduce((a, b) => a + b, 0) / 3;
    const resist2 = sortedHighs.slice(1, 4).reduce((a, b) => a + b, 0) / 3;

    const volByHour: Record<number, number[]> = {};
    klines.forEach((k) => {
      const hour = new Date(k.openTime).getUTCHours() + 8;
      const h = ((hour % 24) + 24) % 24;
      if (!volByHour[h]) volByHour[h] = [];
      volByHour[h].push(Number(k.volume));
    });
    const avgVolByHour: Record<number, number> = {};
    Object.entries(volByHour).forEach(([h, vs]) => {
      avgVolByHour[Number(h)] = vs.reduce((a, b) => a + b, 0) / vs.length;
    });
    const totalAvgVol = vols.reduce((a, b) => a + b, 0) / n;
    const nowHourBJ = ((new Date().getUTCHours() + 8) % 24 + 24) % 24;

    const marketStructure = this.analyzeMarketStructure(highs, lows);

    return {
      closes,
      highs,
      lows,
      vols,
      n,
      ema20,
      ema30,
      macd: macd.toFixed(2),
      rsi: rsi.toFixed(1),
      bbUpper: bbUpper.toFixed(2),
      bbMid: bbMid.toFixed(2),
      bbLower: bbLower.toFixed(2),
      supportLevel: supportLevel.toFixed(2),
      resistLevel: resistLevel.toFixed(2),
      support2: support2.toFixed(2),
      resist2: resist2.toFixed(2),
      avgVolByHour,
      totalAvgVol,
      nowHourBJ,
      marketStructure
    };
  }

  private buildPrompt(data: MarketSummary): string {
    const { ticker, klines, orderBook } = data;
    const ind = this.calcIndicators(klines);

    const latestClose = ind.closes[ind.closes.length - 1];
    const prevClose = ind.closes[ind.closes.length - 2] || latestClose;
    const priceChange1Period = (((latestClose - prevClose) / prevClose) * 100).toFixed(2);

    const symbol = ticker.symbol;
    const baseSymbol = symbol.replace(/USDT$/, "");

    const recentKlines = klines.slice(-8).map((k) => {
      const vol = Number(k.volume);
      const volRatio = (vol / ind.totalAvgVol).toFixed(2);
      return {
        时间: new Date(k.openTime).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
        开: k.open,
        高: k.high,
        低: k.low,
        收: k.close,
        成交量: vol.toFixed(2),
        量比: `${volRatio}x`
      };
    });

    const topBids = orderBook.bids.slice(0, 10);
    const topAsks = orderBook.asks.slice(0, 10);
    const totalBidVol = topBids.reduce((s, b) => s + Number(b[1]), 0).toFixed(2);
    const totalAskVol = topAsks.reduce((s, a) => s + Number(a[1]), 0).toFixed(2);
    const bidAskRatio = (Number(totalBidVol) / (Number(totalAskVol) || 1)).toFixed(2);

    const hourEntries = Object.entries(ind.avgVolByHour)
      .map(([h, v]) => ({ hour: Number(h), vol: v }))
      .sort((a, b) => b.vol - a.vol);
    const top6Hours = hourEntries.slice(0, 6).map((e) => `${e.hour}:00`).join("、");
    const currentHourVol = ind.avgVolByHour[ind.nowHourBJ] || 0;
    const currentHourRatio = (currentHourVol / ind.totalAvgVol).toFixed(2);

    const nowStr = new Date(data.timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    return `
你是一位专业的加密货币量化分析师，擅长技术分析、订单流分析和市场微观结构研究。
请根据以下 ${baseSymbol}/USDT 完整行情数据，输出一份专业的结构化分析报告。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【一、实时行情快照】（${nowStr}，北京时间）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 指标 | 数值 |
|------|------|
| 当前价格 | $${Number(ticker.price).toLocaleString()} |
| 24h 涨跌幅 | ${ticker.priceChangePercent}% |
| 24h 最高 | $${Number(ticker.highPrice).toLocaleString()} |
| 24h 最低 | $${Number(ticker.lowPrice).toLocaleString()} |
| 24h 成交量(${baseSymbol}) | ${Number(ticker.volume).toFixed(2)} |
| 24h 成交额(USDT) | $${(Number(ticker.quoteVolume) / 1e6).toFixed(2)}M |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【二、技术指标】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 指标 | 数值 | 信号 |
|------|------|------|
| EMA20 | $${ind.ema20.toFixed(2)} | ${latestClose > ind.ema20 ? "价格在上方 ▲ 偏多" : "价格在下方 ▼ 偏空"} |
| EMA30 | $${ind.ema30.toFixed(2)} | ${latestClose > ind.ema30 ? "价格在上方 ▲ 偏多" : "价格在下方 ▼ 偏空"} |
| EMA20/EMA30关系 | — | ${ind.ema20 > ind.ema30 ? "EMA20 > EMA30 金叉 ▲ 多头排列" : "EMA20 < EMA30 死叉 ▼ 空头排列"} |
| RSI(14) | ${ind.rsi} | ${Number(ind.rsi) > 70 ? "超买区间 ⚠️" : Number(ind.rsi) < 30 ? "超卖区间 ⚠️" : "中性区间"} |
| MACD柱 | ${ind.macd} | ${Number(ind.macd) > 0 ? "多头动能 ▲" : "空头动能 ▼"} |
| 布林上轨 | $${ind.bbUpper} | ${latestClose > Number(ind.bbUpper) ? "突破上轨 ⚠️" : "轨道内"} |
| 布林中轨 | $${ind.bbMid} | — |
| 布林下轨 | $${ind.bbLower} | ${latestClose < Number(ind.bbLower) ? "跌破下轨 ⚠️" : "轨道内"} |
| 最近1根K线涨跌 | ${priceChange1Period}% | — |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【三、市场结构分析（HH/HL/LL/LH）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 分析维度 | 结果 | 说明 |
|----------|------|------|
| 市场结构 | ${ind.marketStructure.structure} | ${
      ind.marketStructure.trendDirection === "多头"
        ? "多头趋势确立 ✅"
        : ind.marketStructure.trendDirection === "空头"
          ? "空头趋势确立 ⚠️"
          : "震荡整理"
    } |
| 结构模式 | ${ind.marketStructure.structurePattern} | ${
      ind.marketStructure.structurePattern === "HH+HL"
        ? "Higher Highs + Higher Lows（上升趋势）"
        : ind.marketStructure.structurePattern === "LL+LH"
          ? "Lower Lows + Lower Highs（下降趋势）"
          : ind.marketStructure.structurePattern === "HH+LL"
            ? "Higher Highs + Lower Lows（扩张结构）"
            : ind.marketStructure.structurePattern === "LH+HL"
              ? "Lower Highs + Higher Lows（收敛结构）"
              : "待确认"
    } |
| 最近摆动高点 | $${ind.marketStructure.lastSwingHigh} | 最近明显的高点（阻力参考） |
| 最近摆动低点 | $${ind.marketStructure.lastSwingLow} | 最近明显的低点（支撑参考） |
| 摆动高点序列 | ${ind.marketStructure.swingHighs.join(" → ")} | 最近3个摆动高点价格演变 |
| 摆动低点序列 | ${ind.marketStructure.swingLows.join(" → ")} | 最近3个摆动低点价格演变 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【四、支撑与阻力位】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 类型 | 价格 |
|------|------|
| 强阻力位（近期最高） | $${ind.resistLevel} |
| 次级阻力位 | $${ind.resist2} |
| 次级支撑位 | $${ind.support2} |
| 强支撑位（近期最低） | $${ind.supportLevel} |
| 布林上轨（动态阻力） | $${ind.bbUpper} |
| 布林下轨（动态支撑） | $${ind.bbLower} |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【五、最近 8 根 K 线（含量比）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(recentKlines).replace(/["\\]/g, "")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【六、订单簿深度（前10档）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

买盘（Bids）合计: ${totalBidVol} ${baseSymbol}
${topBids.map((b, i) => `  [${i + 1}] 价格: $${b[0]}  数量: ${b[1]} ${baseSymbol}`).join("\n")}

卖盘（Asks）合计: ${totalAskVol} ${baseSymbol}
${topAsks.map((a, i) => `  [${i + 1}] 价格: $${a[0]}  数量: ${a[1]} ${baseSymbol}`).join("\n")}

买卖盘比（Bid/Ask Ratio）: ${bidAskRatio}
（>1.2 偏多头压力，<0.8 偏空头压力）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【七、资金活跃时段数据（北京时间）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

基于本次获取的 K 线数据，各小时平均成交量排名（前6活跃时段）：
${top6Hours}

当前北京时间: ${ind.nowHourBJ}:00
当前时段量比: ${currentHourRatio}x（相对全时段平均）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请严格按以下 JSON 格式输出分析结果（只输出 JSON，不要有任何其他文字、注释或 markdown 代码块）：

{
  "trend": "上涨|下跌|震荡",
  "summary": "不超过120字的行情总结，包含当前价格位置、趋势强度、市场情绪",
  "keyPoints": [
    "关键点1（技术面）",
    "关键点2（资金面）",
    "关键点3（结构面）",
    "关键点4（风险点）"
  ],
  "buyZone": {
    "priceRange": "建议买入价格区间，例如：$103,000 - $104,500",
    "reason": "买入理由，结合支撑位、布林下轨、RSI超卖、量比等综合判断",
    "strength": "强|中|弱"
  },
  "sellZone": {
    "priceRange": "建议卖出/止盈价格区间，例如：$108,000 - $109,500",
    "reason": "卖出理由，结合阻力位、布林上轨、RSI超买、量比等综合判断",
    "strength": "强|中|弱"
  },
  "activeTimeAnalysis": {
    "mostActiveHours": "基于数据分析的最活跃时段（北京时间），例如：22:00-02:00、14:00-16:00",
    "currentTimeStatus": "当前时段（${ind.nowHourBJ}:00 北京时间）的资金活跃度评价，结合量比数据",
    "suggestion": "基于当前时段特征的操作建议，例如是否适合追单、是否需要等待流动性窗口"
  },
  "riskWarning": "风险提示，包含止损位建议",
  "suggestion": "综合操作建议（仅供参考，不构成投资建议）"
}
`.trim();
  }

  async analyze(data: MarketSummary): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(data);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "你是专业的加密货币量化分析师，擅长技术分析、订单流分析和市场微观结构研究。" +
            "请严格按照用户要求的 JSON 格式输出，不要输出任何额外内容、注释或 markdown 代码块。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4096
    });

    const content = response.choices[0]?.message?.content || "{}";
    return this.parseAnalysisContent(data, content);
  }

  async analyzeStream(data: MarketSummary, onDelta: (delta: string) => void, signal?: AbortSignal): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(data);

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "你是专业的加密货币量化分析师，擅长技术分析、订单流分析和市场微观结构研究。" +
              "请严格按照用户要求的 JSON 格式输出，不要输出任何额外内容、注释或 markdown 代码块。"
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4096,
        stream: true
      },
      { signal }
    );

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }

    return this.parseAnalysisContent(data, full || "{}");
  }

  private parseAnalysisContent(data: MarketSummary, content: string): AnalysisResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`DeepSeek 返回格式异常: ${content}`);
    }

    let jsonStr = jsonMatch[0]
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u0000/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
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
      parsed = JSON.parse(jsonStr);
    }

    return {
      timestamp: data.timestamp,
      currentPrice: data.ticker.price,
      trend: parsed.trend || "震荡",
      summary: parsed.summary || "",
      keyPoints: parsed.keyPoints || [],
      buyZone: parsed.buyZone || { priceRange: "—", reason: "—", strength: "弱" },
      sellZone: parsed.sellZone || { priceRange: "—", reason: "—", strength: "弱" },
      activeTimeAnalysis: parsed.activeTimeAnalysis || { mostActiveHours: "—", currentTimeStatus: "—", suggestion: "—" },
      riskWarning: parsed.riskWarning || "",
      suggestion: parsed.suggestion || ""
    };
  }
}

