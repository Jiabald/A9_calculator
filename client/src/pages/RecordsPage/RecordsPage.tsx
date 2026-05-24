import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Popup, Select, Textarea } from "tdesign-react";
import type { InputNumberValue, SelectValue } from "tdesign-react";
import { createPosition, deletePosition, fetchPositions, patchPosition, updatePosition } from "../../api";
import {
  calcSidePriceDiff,
  createOpenRecordPayload,
  currencyFormatter,
  formatLossRatioPercent,
  formatNumber,
  getTradeResult,
  toNumber
} from "../CalculatorPage/calculator";
import { DEFAULT_PRINCIPAL } from "../../types";
import type { PositionPayload, PositionRecord, TradeSide } from "../../types";
import { add } from "../../utils/precision";
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
  fundingFee: string;
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
  fundingFee: "",
  notes: ""
};

function RecordsPage() {
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [form, setForm] = useState<OpenRecordForm>(initialOpenRecordForm);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [closeModal, setCloseModal] = useState<CloseModalState | null>(null);
  const [status, setStatus] = useState("正在加载仓位记录...");

  const isEditMode = editingId !== null;

  const stopLossError = useMemo(() => {
    const entry = toNumber(form.entryPrice);
    const sl = toNumber(form.stopLoss);
    if (entry <= 0 || sl <= 0) return "";
    if (form.side === "long" && sl > entry) return "做多止损价格不能高于入场价格";
    if (form.side === "short" && sl < entry) return "做空止损价格不能低于入场价格";
    return "";
  }, [form.side, form.entryPrice, form.stopLoss]);

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

  function openCreateModal() {
    setForm({ ...initialOpenRecordForm });
    setEditingId(null);
    setIsFormModalOpen(true);
  }

  function openEditModal(record: PositionRecord) {
    setForm(recordToForm(record));
    setEditingId(record.id);
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setIsFormModalOpen(false);
    setEditingId(null);
  }

  async function handleSubmitOpenRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (stopLossError) {
      setStatus(stopLossError);
      return;
    }

    const existing = editingId ? positions.find((position) => position.id === editingId) : undefined;
    const payload = buildOpenRecordPayload(form, existing?.principal);
    if (!payload) {
      setStatus("请填写品种、入场价、止损价、杠杆、仓位价值和入场逻辑");
      return;
    }

    try {
      if (editingId) {
        await patchPosition(editingId, {
          ...payload,
          takeProfit: payload.takeProfit ?? null,
          closePrice: existing?.closePrice ?? null,
          tradeDate: existing?.tradeDate ?? payload.tradeDate
        });
        setStatus("开仓记录已更新");
      } else {
        await createPosition(payload);
        setStatus("开仓记录已新增");
      }
      setForm({ ...initialOpenRecordForm });
      closeFormModal();
      await loadPositions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : editingId ? "更新失败" : "新增失败");
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
        <button className="primary-button hero-action" type="button" onClick={openCreateModal}>
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

      {isFormModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeFormModal}>
          <div className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="create-record-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Records</p>
                <h2 id="create-record-title" style={{ marginTop: 4 }}>{isEditMode ? "编辑开仓记录" : "新增开仓记录"}</h2>
              </div>
              <Button theme="default" variant="outline" size="small" onClick={closeFormModal}>关闭</Button>
            </div>

            <form onSubmit={handleSubmitOpenRecord}>

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
                    status={stopLossError ? "error" : undefined}
                    tips={stopLossError || undefined}
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
                <label className="td-label">
                  <FieldLabel text="资金费" optional />
                  <InputNumber
                    value={asNum(form.fundingFee)}
                    step={0.01}
                    decimalPlaces={4}
                    suffix=" USDT"
                    placeholder="正=收入，负=支出"
                    tips="正数表示收取的资金费，负数表示支付的资金费；未填默认 0"
                    theme="normal"
                    style={{ width: "100%" }}
                    onChange={(val: InputNumberValue) =>
                      updateField("fundingFee", val === "" ? "" : String(val))
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
                  {isEditMode ? "保存修改" : "新增开仓记录"}
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
                <th>本金</th>
                <th>风险</th>
                <th>手续费损耗</th>
                <th>资金费</th>
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
                    <td>{formatLossRatioPercent(position.lossRatio)}</td>
                    <td>{currencyFormatter.format(position.positionValue)}</td>
                    <td>{formatNumber(position.positionSize)}</td>
                    <td>
                      {tradeResult ? (
                        <div className={styles.principalCell}>
                          <span>{currencyFormatter.format(add(position.principal, tradeResult.profitLoss))}</span>
                          <span className={`${styles.principalDelta} ${getProfitLossClassName(tradeResult.profitLoss)}`}>
                            {tradeResult.profitLoss >= 0 ? "+" : ""}
                            {currencyFormatter.format(tradeResult.profitLoss)}
                          </span>
                        </div>
                      ) : (
                        currencyFormatter.format(position.principal)
                      )}
                    </td>
                    <td>{currencyFormatter.format(position.riskAmount)}</td>
                    <td>{tradeResult ? currencyFormatter.format(tradeResult.feeLoss) : "-"}</td>
                    <td className={getProfitLossClassName(position.fundingFee)}>
                      {position.fundingFee > 0 ? "+" : ""}
                      {currencyFormatter.format(position.fundingFee)}
                    </td>
                    <td className={tradeResult ? getProfitLossClassName(tradeResult.profitLoss) : undefined}>
                      {tradeResult ? currencyFormatter.format(tradeResult.profitLoss) : "-"}
                    </td>
                    <td className={styles.notesCell}>
                      {position.notes ? (
                        <Popup
                          content={<div className={styles.notesPopupContent}>{position.notes}</div>}
                          placement="top"
                          showArrow
                          trigger="hover"
                          overlayInnerStyle={{ maxWidth: 360 }}
                        >
                          <span className={styles.notesTruncate}>{position.notes}</span>
                        </Popup>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button type="button" className="pill-button" onClick={() => openEditModal(position)}>
                          编辑
                        </button>
                        <button type="button" className="danger pill-button" onClick={() => void handleDelete(position.id)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!positions.length && (
                <tr>
                  <td colSpan={19} className={styles.emptyCell}>
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

function recordToForm(record: PositionRecord): OpenRecordForm {
  return {
    symbol: record.symbol,
    side: record.side,
    entryPrice: String(record.entryPrice),
    stopLoss: String(record.stopLoss),
    takeProfit: record.takeProfit !== undefined ? String(record.takeProfit) : "",
    leverage: String(record.leverage),
    positionValue: String(record.positionValue),
    openFeeRate: String(record.openFeeRate),
    closeFeeRate: String(record.closeFeeRate),
    fundingFee: record.fundingFee ? String(record.fundingFee) : "",
    notes: record.notes ?? ""
  };
}

function buildOpenRecordPayload(form: OpenRecordForm, principal?: number): PositionPayload | null {
  const entryPrice = toNumber(form.entryPrice);
  const stopLoss = toNumber(form.stopLoss);
  const takeProfit = form.takeProfit ? toNumber(form.takeProfit) : undefined;
  const leverage = toNumber(form.leverage);
  const positionValue = toNumber(form.positionValue);
  const fundingFee = form.fundingFee ? toNumber(form.fundingFee) : 0;

  if (!form.symbol.trim() || !form.notes.trim() || entryPrice <= 0 || stopLoss <= 0 || leverage <= 0 || positionValue <= 0) {
    return null;
  }

  return createOpenRecordPayload({
    symbol: form.symbol,
    side: form.side,
    entryPrice,
    stopLoss,
    takeProfit,
    leverage,
    positionValue,
    openFeeRate: toNumber(form.openFeeRate),
    closeFeeRate: toNumber(form.closeFeeRate),
    principal: principal ?? DEFAULT_PRINCIPAL,
    fundingFee,
    notes: form.notes
  });
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
    principal: record.principal,
    fundingFee: record.fundingFee,
    closePrice,
    notes: record.notes,
    tradeDate: record.tradeDate
  };
}

function getPositionStatus(record: PositionRecord): PositionStatus {
  if (record.closePrice === undefined) {
    return { label: "持仓中", className: "holding" };
  }

  const profit = calcSidePriceDiff(record.side, record.entryPrice, record.closePrice);

  if (profit > 0) return { label: "已止盈", className: "take-profit" };
  if (profit < 0) return { label: "已止损", className: "stop-loss" };
  return { label: "已平仓", className: "closed" };
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
