import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "tdesign-react";
import { fetchTradeReview } from "../../api";
import type { TradeReviewRecord } from "../../types";
import { ENTRY_MODE_OPTIONS, MARKET_CYCLE_OPTIONS, TIMEFRAME_OPTIONS, TRADE_TYPE_OPTIONS } from "./constants";
import ScreenshotGallery, { type ScreenshotGalleryHandle } from "./ScreenshotGallery";
import styles from "./TradeReview.module.css";

function labelOf(options: { label: string; value: string }[], value?: string) {
  if (!value) return "-";
  return options.find((item) => item.value === value)?.label ?? value;
}

function formatPl(value?: number) {
  if (value === undefined) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function plClass(value?: number) {
  if (value === undefined) return "";
  if (value > 0) return styles.plPositive;
  if (value < 0) return styles.plNegative;
  return "";
}

function TradeReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const galleryRef = useRef<ScreenshotGalleryHandle>(null);
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
      <div className={styles.detailPage}>
        <Link className={styles.backLink} to="/reviews">← 返回列表</Link>
        <section className="panel">
          <p className="status">{status}</p>
        </section>
      </div>
    );
  }

  if (!record) return null;

  const hasScreenshots = record.screenshots.length > 0;
  const entryModeLabel = labelOf(ENTRY_MODE_OPTIONS, record.entryMode);
  const timeframeLabel = labelOf(TIMEFRAME_OPTIONS, record.timeframe);

  return (
    <div className={styles.detailPage}>
      <Link className={styles.backLink} to="/reviews">← 返回列表</Link>

      <header className={`panel ${styles.detailHeader}`}>
        <div className={styles.detailHeaderMain}>
          <p className="eyebrow">Review Detail</p>
          <h1 className={styles.detailTitle}>{record.strategy}</h1>
          <div className={styles.detailMeta}>
            <span className={styles.metaChip}>{record.symbol}</span>
            <span className={`${styles.metaChip} ${record.side === "long" ? styles.sideLong : styles.sideShort}`}>
              {record.side === "long" ? "做多" : "做空"}
            </span>
            <span className={styles.metaChip}>{record.tradeDate}</span>
            <span className={styles.metaChipMuted}>{entryModeLabel}</span>
            {record.timeframe && <span className={styles.metaChipMuted}>{timeframeLabel}</span>}
          </div>
        </div>
        <div className={styles.detailHeaderActions}>
          <Link
            className={`ghost-button ${styles.detailHeaderAction}`}
            to={`/reviews/${record.id}/edit`}
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            重新编辑
          </Link>
          <Link className={`primary-button ${styles.detailHeaderAction}`} to="/reviews/new">
            再记一条
          </Link>
        </div>
      </header>

      <section className={styles.detailStats}>
        <div className={`${styles.statCard} ${plClass(record.profitLoss)}`}>
          <span className={styles.statLabel}>盈亏 P/L</span>
          <strong className={styles.statValue}>{formatPl(record.profitLoss)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>盈亏比 R</span>
          <strong className={styles.statValue}>
            {record.riskReward !== undefined ? `${record.riskReward}R` : "-"}
          </strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>执行信心</span>
          <strong className={styles.statValue}>
            {record.executionConfidence ? `${record.executionConfidence} / 5` : "-"}
          </strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>市场周期</span>
          <strong className={styles.statValue}>{labelOf(MARKET_CYCLE_OPTIONS, record.marketCycle)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>交易类型</span>
          <strong className={styles.statValue}>{labelOf(TRADE_TYPE_OPTIONS, record.tradeType)}</strong>
        </div>
      </section>

      <div className={`${styles.detailLayout} ${!hasScreenshots ? styles.detailLayoutNoMedia : ""}`}>
        {hasScreenshots && (
          <section className={`panel ${styles.detailMedia}`}>
            <ScreenshotGallery ref={galleryRef} images={record.screenshots} />
          </section>
        )}

        <div className={styles.detailContent}>
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
                <span className={styles.detailValue}>{entryModeLabel}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>交易日期</span>
                <span className={styles.detailValue}>{record.tradeDate}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>周期</span>
                <span className={styles.detailValue}>{timeframeLabel}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="form-section-title">
              <span className="section-title-text">交易逻辑</span>
            </div>
            <div className={styles.logicGrid}>
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
                <div className={`${styles.detailBlock} ${styles.detailBlockFull}`}>
                  <h4 className={styles.detailBlockTitle}>复盘备注</h4>
                  <p className={styles.detailText}>{record.reviewNotes}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TradeReviewDetailPage;
