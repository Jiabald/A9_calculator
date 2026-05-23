import { FormEvent, useEffect, useState } from "react";
import { Button, Input, InputNumber, Select, Textarea } from "tdesign-react";
import type { InputNumberValue, SelectValue } from "tdesign-react";
import { createPosition, deletePosition, fetchPositions, updatePosition } from "../../api";
import { currencyFormatter, formatNumber, today, toNumber } from "../../calculator";
import type { PositionPayload, PositionRecord, TradeSide } from "../../types";
import styles from "./RecordsPage.module.css";

type OpenRecordForm = {
  symbol: string;
  side: TradeSide;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  leverage: string;
  positionValue: string;
  openFeeRate: string;
  closeFeeRate: string;
  notes: string;
};

const DIRECTION_OPTIONS = [
  { label: "做多 Long", value: "long" },
  { label: "做空 Short", value: "short" }
];

function asNum(str: string): number | "" {
  const n = Number(str);
  return str !== "" && Number.isFinite(n) ? n : "";
}

type PositionStatus = {
  label: string;
  className: string;
};

type TradeResult = {
  feeLoss: number;
  profitLoss: number;
};

type CloseModalState = {
  record: PositionRecord;
  closePrice: string;
};

const initialOpenRecordForm: OpenRecordForm = {
  symbol: "BTCUSDT",
  side: "long",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
  leverage: "10",
  positionValue: "",
  openFeeRate: "0.05",
  closeFeeRate: "0.05",
  notes: ""
};

function RecordsPage() {
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [form, setForm] = useState<OpenRecordForm>(initialOpenRecordForm);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [closeModal, setCloseModal] = useState<CloseModalState | null>(null);
  const [status, setStatus] = useState("正在加载仓位记录...");

  useEffect(() => {
    void loadPositions();
  }, []);

  async function loadPositions() {
    try {
      const data = await fetchPositions();
      setPositions(data);
      setStatus(data.length ? "" : "暂无仓位记录");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加载失败");
    }
  }

  function updateField<K extends keyof OpenRecordForm>(key: K, value: OpenRecordForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateOpenRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = createOpenRecordPayload(form);
    if (!payload) {
      setStatus("请填写品种、入场价、止损价、杠杆、仓位价值和入场逻辑");
      return;
    }

    try {
      await createPosition(payload);
      setForm({ ...initialOpenRecordForm });
      setIsCreateModalOpen(false);
      setStatus("开仓记录已新增");
      await loadPositions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "新增失败");
    }
  }

  function openCloseModal(record: PositionRecord) {
    setCloseModal({
      record,
      closePrice: record.closePrice !== undefined ? String(record.closePrice) : ""
    });
  }

  async function handleCloseModalSave() {
    if (!closeModal) return;
    const { record, closePrice } = closeModal;
    const parsed = closePrice.trim() ? toNumber(closePrice) : undefined;
    const payload = toPayload(record, parsed);

    try {
      await updatePosition(record.id, payload);
      setStatus(parsed !== undefined ? "平仓价格已保存" : "已清空平仓价格");
      setCloseModal(null);
      await loadPositions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePosition(id);
      setStatus("仓位记录已删除");
      await loadPositions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Records</p>
          <h1>仓位记录</h1>
          <p className="hero-text">先新增开仓记录，持仓过程中可以补充平仓价格，系统会判断持仓中、已止盈或已止损。</p>
        </div>
        <button className="primary-button hero-action" type="button" onClick={() => setIsCreateModalOpen(true)}>
          新增开仓记录
        </button>
      </section>

      {closeModal && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setCloseModal(null)}>
          <div className={styles.modalPanelSm} role="dialog" aria-modal="true" aria-labelledby="close-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <h2 id="close-modal-title">平仓操作</h2>
                <p className={styles.modalSubtitle}>
                  {closeModal.record.symbol} &nbsp;
                  <span
                    className={statusBadgeClass(closeModal.record.side === "long" ? "holding" : "stop-loss")}
                    style={{ fontSize: 12, padding: "3px 8px" }}
                  >
                    {closeModal.record.side === "long" ? "做多" : "做空"}
                  </span>
                  &nbsp; 入场 {formatNumber(closeModal.record.entryPrice)}
                  &nbsp;·&nbsp; 止损 {formatNumber(closeModal.record.stopLoss)}
                  {closeModal.record.takeProfit ? ` · 止盈 ${formatNumber(closeModal.record.takeProfit)}` : ""}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setCloseModal(null)}>关闭</button>
            </div>

            <div className={styles.closeModalBody}>
              <label className={styles.closeModalLabel}>
                平仓价格
                <input
                  type="number"
                  value={closeModal.closePrice}
                  placeholder="输入平仓价格"
                  autoFocus
                  onChange={(e) => setCloseModal((m) => m ? { ...m, closePrice: e.target.value } : m)}
                />
              </label>
              {closeModal.closePrice.trim() && (() => {
                const preview = getPositionStatus({ ...closeModal.record, closePrice: toNumber(closeModal.closePrice) });
                return (
                  <div className={styles.closeModalPreview}>
                    平仓后状态：<span className={statusBadgeClass(preview.className)}>{preview.label}</span>
                  </div>
                );
              })()}
            </div>

            <div className={styles.closeModalActions}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCloseModal((m) => m ? { ...m, closePrice: "" } : m)}
              >
                清空平仓价
              </button>
              <button className="primary-button" type="button" onClick={() => void handleCloseModalSave()}>
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setIsCreateModalOpen(false)}>
          <div className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="create-record-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Records</p>
                <h2 id="create-record-title" style={{ marginTop: 4 }}>新增开仓记录</h2>
              </div>
              <Button theme="default" variant="outline" size="small" onClick={() => setIsCreateModalOpen(false)}>关闭</Button>
            </div>

            <form onSubmit={handleCreateOpenRecord}>

              <div className={styles.modalSectionTitle}>
                <span className="section-title-text">品种与方向</span>
              </div>
              <div className="form-grid-account">
                <label className="td-label account-field">
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
                <label className="td-label">
                  杠杆倍数
                  <InputNumber
                    value={asNum(form.leverage)}
                    min={1}
                    max={125}
                    step={1}
                    decimalPlaces={0}
                    suffix="x"
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("leverage", val === "" ? "" : String(val))
                    }
                  />
                </label>
              </div>

              <div className={styles.modalSectionTitle}>
                <span className="section-title-text">价格</span>
              </div>
              <div className="form-grid-3">
                <label className="td-label">
                  入场价格
                  <InputNumber
                    value={asNum(form.entryPrice)}
                    min={0}
                    step={1}
                    decimalPlaces={6}
                    placeholder="入场价"
                    theme="normal"
                    style={{ width: "100%" }}
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
                    placeholder="止损价"
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("stopLoss", val === "" ? "" : String(val))
                    }
                  />
                </label>
                <label className="td-label">
                  <FieldLabel text="止盈价格" optional />
                  <InputNumber
                    value={asNum(form.takeProfit)}
                    min={0}
                    step={1}
                    decimalPlaces={6}
                    placeholder="止盈价"
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("takeProfit", val === "" ? "" : String(val))
                    }
                  />
                </label>
              </div>

              <div className={styles.modalSectionTitle}>
                <span className="section-title-text">仓位与手续费</span>
              </div>
              <div className="form-grid-3">
                <label className="td-label">
                  <FieldLabel text="仓位价值" />
                  <InputNumber
                    value={asNum(form.positionValue)}
                    min={0}
                    step={100}
                    decimalPlaces={2}
                    suffix=" USDT"
                    placeholder="仓位总价值"
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("positionValue", val === "" ? "" : String(val))
                    }
                  />
                </label>
                <label className="td-label">
                  开仓手续费 %
                  <InputNumber
                    value={asNum(form.openFeeRate)}
                    min={0}
                    max={1}
                    step={0.01}
                    decimalPlaces={3}
                    theme="normal"
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
                    decimalPlaces={3}
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("closeFeeRate", val === "" ? "" : String(val))
                    }
                  />
                </label>
              </div>

              <div className={styles.modalSectionTitle}>
                <span className="section-title-text">入场逻辑</span>
              </div>
              <label className="td-label">
                <FieldLabel text="入场逻辑" />
                <Textarea
                  value={form.notes}
                  placeholder="请填写开仓依据、策略与入场理由"
                  autosize={{ minRows: 2, maxRows: 5 }}
                  onChange={(val: string) => updateField("notes", val)}
                />
              </label>

              <div className={styles.modalSubmitRow}>
                <Button type="submit" theme="primary" size="large" block>
                  新增开仓记录
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className={`panel ${styles.recordsPanel}`}>
        <div className="panel-heading">
          <h2>记录列表</h2>
          {status && <span className="status">{status}</span>}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日期</th>
                <th>品种</th>
                <th>方向</th>
                <th>入场</th>
                <th>止损</th>
                <th>止盈</th>
                <th>状态</th>
                <th>平仓价格</th>
                <th>杠杆</th>
                <th>亏损比例</th>
                <th>仓位价值</th>
                <th>仓位数量</th>
                <th>风险</th>
                <th>手续费损耗</th>
                <th>交易盈亏</th>
                <th>入场逻辑</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const positionStatus = getPositionStatus(position);
                const tradeResult = getTradeResult(position);

                return (
                  <tr key={position.id}>
                    <td>{position.tradeDate}</td>
                    <td>{position.symbol}</td>
                    <td>{position.side === "long" ? "做多" : "做空"}</td>
                    <td>{formatNumber(position.entryPrice)}</td>
                    <td>{formatNumber(position.stopLoss)}</td>
                    <td>{position.takeProfit ? formatNumber(position.takeProfit) : "-"}</td>
                    <td>
                      {positionStatus.className === "holding" ? (
                        <button
                          type="button"
                          className={statusBadgeClass(positionStatus.className, true)}
                          title="点击填写平仓价格"
                          onClick={() => openCloseModal(position)}
                        >
                          {positionStatus.label} ✎
                        </button>
                      ) : (
                        <span className={statusBadgeClass(positionStatus.className)}>{positionStatus.label}</span>
                      )}
                    </td>
                    <td className={styles.closePriceDisplay}>
                      {position.closePrice !== undefined ? formatNumber(position.closePrice) : (
                        <span className={styles.closePriceEmpty}>-</span>
                      )}
                    </td>
                    <td>{position.leverage}x</td>
                    <td>{position.lossRatio.toFixed(4)}%</td>
                    <td>{currencyFormatter.format(position.positionValue)}</td>
                    <td>{formatNumber(position.positionSize)}</td>
                    <td>{currencyFormatter.format(position.riskAmount)}</td>
                    <td>{tradeResult ? currencyFormatter.format(tradeResult.feeLoss) : "-"}</td>
                    <td className={tradeResult ? getProfitLossClassName(tradeResult.profitLoss) : undefined}>
                      {tradeResult ? currencyFormatter.format(tradeResult.profitLoss) : "-"}
                    </td>
                    <td className={styles.notesCell}>{position.notes || "-"}</td>
                    <td>
                      <button type="button" className="danger pill-button" onClick={() => void handleDelete(position.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!positions.length && (
                <tr>
                  <td colSpan={17} className={styles.emptyCell}>
                    还没有记录，可以先新增一条开仓记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function createOpenRecordPayload(form: OpenRecordForm): PositionPayload | null {
  const entryPrice = toNumber(form.entryPrice);
  const stopLoss = toNumber(form.stopLoss);
  const takeProfit = form.takeProfit ? toNumber(form.takeProfit) : undefined;
  const leverage = toNumber(form.leverage);
  const positionValue = toNumber(form.positionValue);

  if (!form.symbol.trim() || !form.notes.trim() || entryPrice <= 0 || stopLoss <= 0 || leverage <= 0 || positionValue <= 0) {
    return null;
  }

  const openFeeRate = toNumber(form.openFeeRate);
  const closeFeeRate = toNumber(form.closeFeeRate);
  const priceLossRatio = Math.abs(entryPrice - stopLoss) / entryPrice;
  const feeRatio = (openFeeRate + closeFeeRate) / 100;
  const lossRatio = (priceLossRatio + feeRatio) * 100;

  return {
    symbol: form.symbol,
    side: form.side,
    entryPrice,
    stopLoss,
    takeProfit,
    leverage,
    positionSize: positionValue / entryPrice,
    positionValue,
    riskAmount: positionValue * (lossRatio / 100),
    lossRatio,
    openFeeRate,
    closeFeeRate,
    closePrice: undefined,
    notes: form.notes,
    tradeDate: today
  };
}

function toPayload(record: PositionRecord, closePrice: number | undefined): PositionPayload {
  return {
    symbol: record.symbol,
    side: record.side,
    entryPrice: record.entryPrice,
    stopLoss: record.stopLoss,
    takeProfit: record.takeProfit,
    leverage: record.leverage,
    positionSize: record.positionSize,
    positionValue: record.positionValue,
    riskAmount: record.riskAmount,
    lossRatio: record.lossRatio,
    openFeeRate: record.openFeeRate,
    closeFeeRate: record.closeFeeRate,
    closePrice,
    notes: record.notes,
    tradeDate: record.tradeDate
  };
}

function getPositionStatus(record: PositionRecord): PositionStatus {
  if (record.closePrice === undefined) {
    return { label: "持仓中", className: "holding" };
  }

  const profit =
    record.side === "long"
      ? record.closePrice - record.entryPrice
      : record.entryPrice - record.closePrice;

  if (profit > 0) return { label: "已止盈", className: "take-profit" };
  if (profit < 0) return { label: "已止损", className: "stop-loss" };
  return { label: "已平仓", className: "closed" };
}

function getTradeResult(record: PositionRecord): TradeResult | null {
  if (record.closePrice === undefined) {
    return null;
  }

  const openFee = record.positionValue * (record.openFeeRate / 100);
  const closeValue = record.closePrice * record.positionSize;
  const closeFee = closeValue * (record.closeFeeRate / 100);
  const priceProfitLoss =
    record.side === "long"
      ? (record.closePrice - record.entryPrice) * record.positionSize
      : (record.entryPrice - record.closePrice) * record.positionSize;
  const feeLoss = openFee + closeFee;

  return {
    feeLoss,
    profitLoss: priceProfitLoss - feeLoss
  };
}

function FieldLabel({ text, optional = false }: { text: string; optional?: boolean }) {
  return (
    <span className={styles.tdLabelHead}>
      <span className={styles.tdLabelText}>{text}</span>
      {optional && <span className={styles.fieldOptional}>可选</span>}
    </span>
  );
}

function getProfitLossClassName(value: number) {
  if (value > 0) {
    return styles.profitValue;
  }

  if (value < 0) {
    return styles.lossValue;
  }

  return styles.flatValue;
}

type StatusVariant = PositionStatus["className"];

function statusBadgeClass(variant: StatusVariant, asButton = false) {
  const base = asButton ? styles.statusBadgeBtn : styles.statusBadge;
  return `${base} ${styles[variant]}`;
}

export default RecordsPage;
