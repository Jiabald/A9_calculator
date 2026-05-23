import { Button, Input, InputNumber, Select, Slider, Textarea } from "tdesign-react";
import type { InputNumberValue, SelectValue } from "tdesign-react";
import { FormEvent, useMemo, useState } from "react";
import { createPosition } from "../api";
import {
  calculatePosition,
  createPayload,
  currencyFormatter,
  formatNumber,
  initialForm,
  toNumber,
  type CalculationResult,
  type CalculatorForm
} from "../calculator";
import type { TradeSide } from "../types";

const RISK_TAGS = ["1", "5", "10", "15", "20"];
const LEVERAGE_TAGS = ["1", "5", "10", "20", "50", "100"];
const DIRECTION_OPTIONS = [
  { label: "做多 Long", value: "long" },
  { label: "做空 Short", value: "short" }
];

function asNum(str: string): number | "" {
  const n = Number(str);
  return str !== "" && Number.isFinite(n) ? n : "";
}

function CalculatorPage() {
  const [form, setForm] = useState<CalculatorForm>({ ...initialForm });
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"ok" | "err">("ok");

  const stopLossError = useMemo(() => {
    const entry = toNumber(form.entryPrice);
    const sl = toNumber(form.stopLoss);
    if (entry <= 0 || sl <= 0) return "";
    if (form.side === "long" && sl >= entry) return "做多止损不能高于或等于入场价";
    if (form.side === "short" && sl <= entry) return "做空止损不能低于或等于入场价";
    return "";
  }, [form.side, form.entryPrice, form.stopLoss]);

  const riskPreview = useMemo(() => {
    const balance = toNumber(form.accountBalance);
    const pct = toNumber(form.riskPercent);
    if (balance <= 0 || pct <= 0) return 0;
    return balance * (pct / 100);
  }, [form.accountBalance, form.riskPercent]);

  function updateField<K extends keyof CalculatorForm>(key: K, value: CalculatorForm[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
    setResult(null);
    setStatus("");
  }

  function handleCalculate() {
    if (stopLossError) {
      setStatus(stopLossError);
      setStatusType("err");
      return;
    }
    const r = calculatePosition(form);
    setResult(r);
    setStatus(r.isValid ? "计算完成" : (r.message ?? "计算结果无效"));
    setStatusType(r.isValid ? "ok" : "err");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stopLossError) {
      setStatus(stopLossError);
      setStatusType("err");
      return;
    }
    if (!result) {
      setStatus('请先点击「计算结果」');
      setStatusType("err");
      return;
    }
    if (!result.isValid) {
      setStatus(result.message ?? "计算结果无效，不能保存");
      setStatusType("err");
      return;
    }
    if (!form.notes.trim()) {
      setStatus("请填写入场逻辑后再保存");
      setStatusType("err");
      return;
    }
    try {
      await createPosition(createPayload(form, result));
      setStatus("仓位记录已保存");
      setStatusType("ok");
      setForm({ ...initialForm });
      setResult(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
      setStatusType("err");
    }
  }

  return (
    <>
      <section className="hero hero-compact">
        <div className="hero-text-wrap">
          <p className="eyebrow">Calculator</p>
          <h1>仓位计算器</h1>
          <p className="hero-text">根据亏损比例、入场价、止损价和杠杆计算仓位价值与仓位数量，手续费已计入总亏损比例。</p>
        </div>
        <div className="formula-card">
          <span>计算方式</span>
          <strong>仓位价值 = 风险金额 ÷ (止损亏损比例 + 开仓手续费率 + 平仓手续费率)</strong>
        </div>
      </section>

      <section className="calc-layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>

          <SectionTitle title="账户与品种" hint={riskPreview > 0 ? `本笔风险预算 ${currencyFormatter.format(riskPreview)} USDT` : undefined} />
          <div className="form-grid-account">
            <label className="td-label account-field">
              账户资金
              <InputNumber
                value={asNum(form.accountBalance)}
                min={0}
                step={1000}
                decimalPlaces={2}
                suffix=" USDT"
                placeholder="请输入账户资金"
                style={{ width: "100%" }}
                theme="normal"
                onChange={(val: InputNumberValue) =>
                  updateField("accountBalance", val === "" ? "" : String(val))
                }
              />
            </label>
            <label className="td-label">
              品种
              <Input
                value={form.symbol}
                placeholder="例：BTCUSDT"
                onChange={(val: string) => updateField("symbol", val)}
              />
            </label>
            <label className="td-label">
              方向
              <Select
                value={form.side}
                options={DIRECTION_OPTIONS}
                onChange={(val: SelectValue) => updateField("side", val as TradeSide)}
              />
            </label>
          </div>

          <SectionTitle title="价格" />
          <div className="form-grid-2">
            <label className="td-label">
              入场价格
              <InputNumber
                value={asNum(form.entryPrice)}
                min={0}
                step={1}
                decimalPlaces={6}
                placeholder="请输入入场价"
                style={{ width: "100%" }}
                theme="normal"
                onChange={(val: InputNumberValue) =>
                  updateField("entryPrice", val === "" ? "" : String(val))
                }
              />
            </label>
            <label className="td-label">
              止损价格
              <InputNumber
                value={asNum(form.stopLoss)}
                min={0}
                step={1}
                decimalPlaces={6}
                placeholder="请输入止损价"
                style={{ width: "100%" }}
                theme="normal"
                status={stopLossError ? "error" : undefined}
                tips={stopLossError || undefined}
                onChange={(val: InputNumberValue) =>
                  updateField("stopLoss", val === "" ? "" : String(val))
                }
              />
            </label>
          </div>

          <SectionTitle title="风险与杠杆" />
          <div className="slider-pair">
            <SliderField
              label="亏损比例"
              value={form.riskPercent}
              unit="%"
              min={0.1}
              max={20}
              step={0.1}
              tags={RISK_TAGS}
              onChange={(v) => updateField("riskPercent", v)}
            />
            <SliderField
              label="杠杆倍数"
              value={form.leverage}
              unit="x"
              min={1}
              max={125}
              step={1}
              tags={LEVERAGE_TAGS}
              onChange={(v) => updateField("leverage", v)}
            />
          </div>

          <SectionTitle title="手续费与入场逻辑" />
          <div className="form-grid-2">
            <label className="td-label">
              开仓手续费 %
              <InputNumber
                value={asNum(form.openFeeRate)}
                min={0}
                max={1}
                step={0.01}
                decimalPlaces={3}
                theme="normal"
                placeholder="0.05"
                style={{ width: "100%" }}
                onChange={(val: InputNumberValue) =>
                  updateField("openFeeRate", val === "" ? "" : String(val))
                }
              />
            </label>
            <label className="td-label">
              平仓手续费 %
              <InputNumber
                value={asNum(form.closeFeeRate)}
                min={0}
                max={1}
                step={0.01}
                theme="normal"
                decimalPlaces={3}
                placeholder="0.05"
                style={{ width: "100%" }}
                onChange={(val: InputNumberValue) =>
                  updateField("closeFeeRate", val === "" ? "" : String(val))
                }
              />
            </label>
          </div>
          <Textarea
            className="notes-textarea"
            value={form.notes}
            placeholder="入场逻辑：可填写交易依据、策略描述等"
            autosize={{ minRows: 2, maxRows: 6 }}
            onChange={(val: string) => updateField("notes", val)}
          />

          <div className="button-row">
            <Button type="button" theme="default" variant="outline" size="large" block onClick={handleCalculate}>
              计算结果
            </Button>
            <Button type="submit" theme="primary" size="large" block>
              保存到仓位记录
            </Button>
          </div>

          {status && (
            <p className={statusType === "ok" ? "status status-ok" : "status status-err"}>{status}</p>
          )}
        </form>

        <aside className="panel result-panel">
          <div className="result-header">
            <h2>计算结果</h2>
            {result?.isValid && <span className="result-chip">已计算</span>}
          </div>
          {!result && (
            <div className="result-empty">
              <div className="result-empty-icon">∑</div>
              <p className="hint">填写参数后点击「计算结果」</p>
              <p className="hint-sub">仓位价值、保证金等将显示在此处</p>
            </div>
          )}
          {result && !result.isValid && (
            <div className="result-empty result-empty-err">
              <div className="result-empty-icon">!</div>
              <p className="hint">{result.message}</p>
            </div>
          )}
          {result?.isValid && (
            <div className="metric-list">
              <Metric label="风险金额" value={`${currencyFormatter.format(result.riskAmount)} USDT`} />
              <Metric label="止损亏损比例" value={`${(result.priceLossRatio * 100).toFixed(4)}%`} />
              <Metric label="手续费合计" value={`${(result.feeRatio * 100).toFixed(4)}%`} />
              <Metric label="开仓手续费" value={`${currencyFormatter.format(result.openFeeAmount)} USDT`} />
              <Metric label="总亏损比例" value={`${(result.totalLossRatio * 100).toFixed(4)}%`} highlight />
              <Metric label="仓位价值" value={`${currencyFormatter.format(result.positionValue)} USDT`} highlight />
              <Metric label="仓位数量" value={formatNumber(result.positionSize)} highlight />
              <Metric label="所需保证金" value={`${currencyFormatter.format(result.margin)} USDT`} />

              <div className="order-suggestion">
                <p className="order-suggestion-title">交易所下单建议</p>
                <div className="order-suggestion-row">
                  <div className="order-suggestion-item">
                    <span className="order-suggestion-label">下单金额</span>
                    <strong className="order-suggestion-value">{currencyFormatter.format(result.positionValue)}</strong>
                    <span className="order-suggestion-unit">USDT</span>
                  </div>
                  <div className="order-suggestion-divider" />
                  <div className="order-suggestion-item">
                    <span className="order-suggestion-label">下单数量</span>
                    <strong className="order-suggestion-value">{formatNumber(result.positionSize)}</strong>
                    <span className="order-suggestion-unit">{form.symbol.replace("USDT", "") || "币"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="form-section-title">
      <span className="section-title-text">{title}</span>
      {hint && <span className="section-title-hint">{hint}</span>}
    </div>
  );
}

function SliderField({
  label,
  value,
  unit,
  min,
  max,
  step,
  tags,
  onChange
}: {
  label: string;
  value: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  tags: string[];
  onChange: (value: string) => void;
}) {
  const numVal = toNumber(value);
  return (
    <div className="slider-field">
      <div className="slider-label">
        <span>{label}</span>
        <strong className="slider-value">
          {value}
          {unit}
        </strong>
      </div>
      <Slider
        value={numVal}
        min={min}
        max={max}
        step={step}
        onChange={(val) => {
          if (typeof val === "number") onChange(String(val));
        }}
      />
      <div className="tag-row">
        {tags.map((tag) => (
          <Button
            key={tag}
            type="button"
            size="small"
            theme={tag === value ? "primary" : "default"}
            variant={tag === value ? "base" : "outline"}
            onClick={() => onChange(tag)}
          >
            {tag}
            {unit}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "metric metric-highlight" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default CalculatorPage;
