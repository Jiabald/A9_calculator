import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, DatePicker, Input, InputNumber, Select, Textarea } from "tdesign-react";
import type { InputNumberValue, SelectValue } from "tdesign-react";
import { createTradeReview, fetchCurrentPrincipal, fetchTradeReview, updateTradeReview } from "../../api";
import type { TradeReviewPayload, TradeReviewRecord, TradeReviewSide } from "../../types";
import CompoundProgressBar from "./CompoundProgressBar";
import ScreenshotUpload from "./ScreenshotUpload";
import {
  DIRECTION_OPTIONS,
  ENTRY_MODE_OPTIONS,
  MARKET_CYCLE_OPTIONS,
  TIMEFRAME_OPTIONS,
  TRADE_TYPE_OPTIONS
} from "./constants";
import styles from "./TradeReview.module.css";

type ReviewFormState = {
  screenshots: string[];
  strategy: string;
  symbol: string;
  side: TradeReviewSide | "";
  entryMode: string;
  tradeDate: string;
  timeframe: string;
  entryReason: string;
  profitTarget: string;
  initialStopLoss: string;
  reviewNotes: string;
  profitLoss: string;
  riskReward: string;
  marketCycle: string;
  tradeType: string;
  executionConfidence: number | undefined;
};

const today = new Date().toISOString().slice(0, 10);

const initialForm: ReviewFormState = {
  screenshots: [],
  strategy: "",
  symbol: "",
  side: "",
  entryMode: "limit",
  tradeDate: today,
  timeframe: "",
  entryReason: "",
  profitTarget: "",
  initialStopLoss: "",
  reviewNotes: "",
  profitLoss: "",
  riskReward: "",
  marketCycle: "",
  tradeType: "",
  executionConfidence: undefined
};

function asNum(str: string): number | "" {
  const n = Number(str);
  return str !== "" && Number.isFinite(n) ? n : "";
}

function recordToForm(record: TradeReviewRecord): ReviewFormState {
  return {
    screenshots: record.screenshots,
    strategy: record.strategy,
    symbol: record.symbol,
    side: record.side,
    entryMode: record.entryMode,
    tradeDate: record.tradeDate,
    timeframe: record.timeframe ?? "",
    entryReason: record.entryReason,
    profitTarget: record.profitTarget,
    initialStopLoss: record.initialStopLoss,
    reviewNotes: record.reviewNotes ?? "",
    profitLoss: record.profitLoss !== undefined ? String(record.profitLoss) : "",
    riskReward: record.riskReward !== undefined ? String(record.riskReward) : "",
    marketCycle: record.marketCycle ?? "",
    tradeType: record.tradeType ?? "",
    executionConfidence: record.executionConfidence
  };
}

function TextareaLabel({ text, required = false, count, max }: { text: string; required?: boolean; count: number; max?: number }) {
  return (
    <div className={styles.textareaHead}>
      <span className="td-label" style={{ margin: 0 }}>
        {text}
      </span>
      <span className={styles.charCount}>
        {max ? `${count}/${max}` : `${count}字`}
      </span>
    </div>
  );
}

function TradeReviewFormPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = Boolean(editId);
  const [form, setForm] = useState<ReviewFormState>(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [currentPrincipal, setCurrentPrincipal] = useState<number | null>(null);
  const [principalLoading, setPrincipalLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setPrincipalLoading(true);
      try {
        const { principal } = await fetchCurrentPrincipal();
        setCurrentPrincipal(principal !== null && Number.isFinite(principal) ? principal : null);
      } catch {
        setCurrentPrincipal(null);
      } finally {
        setPrincipalLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const record = await fetchTradeReview(editId);
        setForm(recordToForm(record));
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  const previewPrincipal = useMemo(() => {
    if (currentPrincipal === null) return null;
    const pl = asNum(form.profitLoss);
    if (pl === "") return currentPrincipal;
    return currentPrincipal + pl;
  }, [currentPrincipal, form.profitLoss]);

  function updateField<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload(): TradeReviewPayload | null {
    if (!form.screenshots.length) {
      setError("请至少上传一张交易截图");
      return null;
    }
    if (!form.strategy.trim() || !form.symbol.trim() || !form.side) {
      setError("请填写交易策略、交易标的和方向");
      return null;
    }
    if (!form.entryMode || !form.tradeDate || !form.entryReason.trim() || !form.profitTarget.trim() || !form.initialStopLoss.trim()) {
      setError("请填写必填的交易信息与交易逻辑");
      return null;
    }

    const payload: TradeReviewPayload = {
      screenshots: form.screenshots,
      strategy: form.strategy.trim(),
      symbol: form.symbol.trim(),
      side: form.side,
      entryMode: form.entryMode,
      tradeDate: form.tradeDate,
      entryReason: form.entryReason.trim(),
      profitTarget: form.profitTarget.trim(),
      initialStopLoss: form.initialStopLoss.trim()
    };

    if (form.timeframe) payload.timeframe = form.timeframe;
    if (form.reviewNotes.trim()) payload.reviewNotes = form.reviewNotes.trim();
    if (form.profitLoss.trim()) payload.profitLoss = Number(form.profitLoss);
    if (form.riskReward.trim()) payload.riskReward = Number(form.riskReward);
    if (form.marketCycle) payload.marketCycle = form.marketCycle;
    if (form.tradeType) payload.tradeType = form.tradeType;
    if (form.executionConfidence) payload.executionConfidence = form.executionConfidence;

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (isEditMode && editId) {
        await updateTradeReview(editId, payload);
        navigate(`/reviews/${editId}`);
      } else {
        const record = await createTradeReview(payload);
        navigate(`/reviews/${record.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditMode ? "更新失败" : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = isEditMode && editId ? `/reviews/${editId}` : "/reviews";

  if (loading) {
    return (
      <>
        <Link className={styles.backLink} to={backTo}>← {isEditMode ? "返回详情" : "返回列表"}</Link>
        <section className="panel">
          <p className="status">正在加载复盘记录...</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Link className={styles.backLink} to={backTo}>← {isEditMode ? "返回详情" : "返回列表"}</Link>

      <section className="hero hero-compact">
        <div className="hero-text-wrap">
          <p className="eyebrow">Review</p>
          <h1>{isEditMode ? "编辑交易复盘" : "记录交易复盘"}</h1>
          <p className="hero-text">
            {isEditMode ? "修改截图、思路与执行细节，保存后返回详情页。" : "聚焦思路 + 截图 + 执行，帮助自己与团队快速复盘。"}
          </p>
        </div>
      </section>

      <div className={styles.formLayout}>
      <form className={`${styles.formPage}`} onSubmit={handleSubmit}>
        <section className={styles.formCard}>
          <ScreenshotUpload value={form.screenshots} onChange={(screenshots) => updateField("screenshots", screenshots)} />
        </section>

        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardIcon} aria-hidden>📋</span>
              <h3 className={styles.cardTitle}>基本信息</h3>
            </div>
          </div>
          <div className="form-grid-3">
            <label className="td-label">
              交易策略
              <Input value={form.strategy} placeholder="BO · Breakout" onChange={(val: string) => updateField("strategy", val)} />
            </label>
            <label className="td-label">
              交易标的
              <Input value={form.symbol} placeholder="# MES" onChange={(val: string) => updateField("symbol", val)} />
            </label>
            <label className="td-label">
              方向
              <Select
                value={form.side || undefined}
                placeholder="选择方向"
                options={DIRECTION_OPTIONS}
                onChange={(val: SelectValue) => updateField("side", val as TradeReviewSide)}
              />
            </label>
            <label className="td-label">
              入场模式
              <Select
                value={form.entryMode}
                options={ENTRY_MODE_OPTIONS}
                onChange={(val: SelectValue) => updateField("entryMode", String(val))}
              />
            </label>
            <label className="td-label">
              交易日期
              <DatePicker
                value={form.tradeDate}
                style={{ width: "100%" }}
                onChange={(val) => updateField("tradeDate", typeof val === "string" ? val : today)}
              />
            </label>
            <label className="td-label">
              周期
              <Select
                value={form.timeframe || undefined}
                placeholder="5M"
                clearable
                options={TIMEFRAME_OPTIONS}
                onChange={(val: SelectValue) => updateField("timeframe", val ? String(val) : "")}
              />
            </label>
          </div>
        </section>

        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardIcon} aria-hidden>💡</span>
              <h3 className={styles.cardTitle}>交易逻辑</h3>
            </div>
          </div>

          <label className="td-label">
            <TextareaLabel text="入场理由" required count={form.entryReason.length} />
            <Textarea
              value={form.entryReason}
              placeholder="关键结构、信号K线、市场情绪..."
              autosize={{ minRows: 3, maxRows: 8 }}
              onChange={(val: string) => updateField("entryReason", val)}
            />
          </label>

          <label className="td-label" style={{ marginTop: 16 }}>
            <TextareaLabel text="盈利目标" required count={form.profitTarget.length} max={300} />
            <Textarea
              value={form.profitTarget}
              maxlength={300}
              placeholder="目标位1、目标位2、移动止损计划..."
              autosize={{ minRows: 2, maxRows: 5 }}
              onChange={(val: string) => updateField("profitTarget", val)}
            />
          </label>

          <label className="td-label" style={{ marginTop: 16 }}>
            <TextareaLabel text="初始止损" required count={form.initialStopLoss.length} max={300} />
            <Textarea
              value={form.initialStopLoss}
              maxlength={300}
              placeholder="具体价格或技术位置（如前一根K线低点）"
              autosize={{ minRows: 2, maxRows: 5 }}
              onChange={(val: string) => updateField("initialStopLoss", val)}
            />
          </label>

          <div className={styles.optionalDivider}>可选信息</div>

          <label className="td-label">
            <TextareaLabel text="复盘备注" count={form.reviewNotes.length} />
            <Textarea
              value={form.reviewNotes}
              placeholder="当时的情绪状态、执行中的犹豫、事后反思..."
              autosize={{ minRows: 3, maxRows: 8 }}
              onChange={(val: string) => updateField("reviewNotes", val)}
            />
          </label>
        </section>

        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardIcon} aria-hidden>📊</span>
                <h3 className={styles.cardTitle}>
                  结果统计<span className={styles.optionalTag}>可选</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="form-grid-3">
            <label className="td-label">
              盈亏 P/L
              <InputNumber
                value={asNum(form.profitLoss)}
                decimalPlaces={2}
                theme="normal"
                style={{ width: "100%" }}
                placeholder="0.00"
                onChange={(val: InputNumberValue) => updateField("profitLoss", val === "" ? "" : String(val))}
              />
            </label>
            <label className="td-label">
              盈亏比 R
              <InputNumber
                value={asNum(form.riskReward)}
                decimalPlaces={2}
                suffix="R"
                theme="normal"
                style={{ width: "100%" }}
                placeholder="1.5"
                onChange={(val: InputNumberValue) => updateField("riskReward", val === "" ? "" : String(val))}
              />
            </label>
            <label className="td-label">
              市场周期
              <Select
                value={form.marketCycle || undefined}
                placeholder="— 未选择"
                clearable
                options={MARKET_CYCLE_OPTIONS}
                onChange={(val: SelectValue) => updateField("marketCycle", val ? String(val) : "")}
              />
            </label>
            <label className="td-label">
              交易类型
              <Select
                value={form.tradeType || undefined}
                placeholder="— 未选择"
                clearable
                options={TRADE_TYPE_OPTIONS}
                onChange={(val: SelectValue) => updateField("tradeType", val ? String(val) : "")}
              />
            </label>
            <label className="td-label">
              执行信心 (1-5)
              <div className={styles.confidenceRow}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={`${styles.confidenceBtn} ${form.executionConfidence === score ? styles.confidenceBtnActive : ""}`}
                    onClick={() =>
                      updateField("executionConfidence", form.executionConfidence === score ? undefined : score)
                    }
                  >
                    {score}
                  </button>
                ))}
              </div>
            </label>
          </div>
        </section>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.submitRow}>
          <Link className="ghost-button" to={backTo} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            取消
          </Link>
          <Button type="submit" theme="primary" size="large" loading={submitting}>
            {isEditMode ? "保存修改" : "保存复盘"}
          </Button>
        </div>
      </form>

      <CompoundProgressBar
        principal={currentPrincipal}
        loading={principalLoading}
        previewPrincipal={previewPrincipal}
      />
      </div>
    </>
  );
}

export default TradeReviewFormPage;
