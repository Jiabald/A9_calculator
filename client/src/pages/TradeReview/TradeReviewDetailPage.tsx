import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTradeReview } from "../../api";
import type { TradeReviewRecord } from "../../types";
import { ENTRY_MODE_OPTIONS, MARKET_CYCLE_OPTIONS, TIMEFRAME_OPTIONS, TRADE_TYPE_OPTIONS } from "./constants";
import styles from "./TradeReview.module.css";

function labelOf(options: { label: string; value: string }[], value?: string) {
  if (!value) return "-";
  return options.find((item) => item.value === value)?.label ?? value;
}

function TradeReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<TradeReviewRecord | null>(null);
  const [status, setStatus] = useState("正在加载详情...");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const data = await fetchTradeReview(id);
        setRecord(data);
        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "加载失败");
      }
    })();
  }, [id]);

  if (status) {
    return (
      <>
        <Link className={styles.backLink} to="/reviews">← 返回列表</Link>
        <section className="panel">
          <p className="status">{status}</p>
        </section>
      </>
    );
  }

  if (!record) return null;

  return (
    <>
      <Link className={styles.backLink} to="/reviews">← 返回列表</Link>

      <section className="hero hero-compact">
        <div className="hero-text-wrap">
          <p className="eyebrow">Review Detail</p>
          <h1>{record.strategy}</h1>
          <p className="hero-text">
            {record.symbol} · {record.side === "long" ? "做多" : "做空"} · {record.tradeDate}
          </p>
        </div>
        <Link className="secondary-button hero-action" to="/reviews/new" style={{ textAlign: "center", textDecoration: "none" }}>
          再记一条
        </Link>
      </section>

      {record.screenshots[0] && (
        <section className={`panel ${styles.detailHero}`}>
          <img className={styles.detailCover} src={record.screenshots[0]} alt="复盘封面" />
          {record.screenshots.length > 1 && (
            <div className={styles.detailGallery}>
              {record.screenshots.slice(1).map((src, index) => (
                <img key={`${src.slice(0, 24)}-${index}`} src={src} alt={`截图 ${index + 2}`} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="form-section-title">
          <span className="section-title-text">基本信息</span>
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>交易策略</span>
            <span className={styles.detailValue}>{record.strategy}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>交易标的</span>
            <span className={styles.detailValue}>{record.symbol}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>方向</span>
            <span className={styles.detailValue}>{record.side === "long" ? "做多 Long" : "做空 Short"}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>入场模式</span>
            <span className={styles.detailValue}>{labelOf(ENTRY_MODE_OPTIONS, record.entryMode)}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>交易日期</span>
            <span className={styles.detailValue}>{record.tradeDate}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>周期</span>
            <span className={styles.detailValue}>{labelOf(TIMEFRAME_OPTIONS, record.timeframe)}</span>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="form-section-title">
          <span className="section-title-text">交易逻辑</span>
        </div>
        <div className={styles.detailBlock}>
          <h4 className={styles.detailBlockTitle}>入场理由</h4>
          <p className={styles.detailText}>{record.entryReason}</p>
        </div>
        <div className={styles.detailBlock}>
          <h4 className={styles.detailBlockTitle}>盈利目标</h4>
          <p className={styles.detailText}>{record.profitTarget}</p>
        </div>
        <div className={styles.detailBlock}>
          <h4 className={styles.detailBlockTitle}>初始止损</h4>
          <p className={styles.detailText}>{record.initialStopLoss}</p>
        </div>
        {record.reviewNotes && (
          <div className={styles.detailBlock}>
            <h4 className={styles.detailBlockTitle}>复盘备注</h4>
            <p className={styles.detailText}>{record.reviewNotes}</p>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="form-section-title">
          <span className="section-title-text">结果统计</span>
          <span className="section-title-hint">可选</span>
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>盈亏 P/L</span>
            <span className={styles.detailValue}>
              {record.profitLoss !== undefined ? record.profitLoss.toFixed(2) : "-"}
            </span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>盈亏比 R</span>
            <span className={styles.detailValue}>
              {record.riskReward !== undefined ? `${record.riskReward}R` : "-"}
            </span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>市场周期</span>
            <span className={styles.detailValue}>{labelOf(MARKET_CYCLE_OPTIONS, record.marketCycle)}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>交易类型</span>
            <span className={styles.detailValue}>{labelOf(TRADE_TYPE_OPTIONS, record.tradeType)}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>执行信心</span>
            <span className={styles.detailValue}>
              {record.executionConfidence ? `${record.executionConfidence} / 5` : "-"}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export default TradeReviewDetailPage;
