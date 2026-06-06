import { useMemo } from "react";
import { currencyFormatter } from "../CalculatorPage/calculator";
import {
  COMPOUND_BASE_PRINCIPAL,
  COMPOUND_GOAL_PRINCIPAL,
  COMPOUND_RATE,
  COMPOUND_TARGET_STEPS,
  compoundProgressPercent,
  compoundStepFromPrincipal
} from "../../utils/compoundProgress";
import styles from "./TradeReview.module.css";

type CompoundProgressBarProps = {
  principal: number | null;
  loading?: boolean;
  /** 填写盈亏后的预览本金（可选） */
  previewPrincipal?: number | null;
};

const MILESTONE_PERCENTS = [0, 25, 50, 75, 100];

function CompoundProgressBar({ principal, loading, previewPrincipal }: CompoundProgressBarProps) {
  const displayPrincipal = previewPrincipal ?? principal;

  const stats = useMemo(() => {
    if (displayPrincipal === null || !Number.isFinite(displayPrincipal)) {
      return null;
    }
    const percent = compoundProgressPercent(displayPrincipal);
    const step = compoundStepFromPrincipal(displayPrincipal);
    return {
      percent,
      step,
      stepRounded: Math.min(COMPOUND_TARGET_STEPS, Math.max(0, Math.round(step)))
    };
  }, [displayPrincipal]);

  const showPreview = previewPrincipal !== null && previewPrincipal !== undefined && principal !== previewPrincipal;

  return (
    <aside className={styles.compoundAside} aria-label="复利进度">
      <div className={styles.compoundCard}>
        <p className={styles.compoundEyebrow}>Compound</p>
        <h3 className={styles.compoundTitle}>复利进度</h3>
        <p className={styles.compoundHint}>
          自 {currencyFormatter.format(COMPOUND_BASE_PRINCIPAL)} 起每步 +{(COMPOUND_RATE * 100).toFixed(0)}%，
          {COMPOUND_TARGET_STEPS} 步为 100%
        </p>

        <div className={styles.compoundTrackWrap}>
          <div className={styles.compoundTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats?.percent ?? 0}>
            {MILESTONE_PERCENTS.map((pct) => (
              <span
                key={pct}
                className={styles.compoundTick}
                style={{ bottom: `${pct}%` }}
                aria-hidden
              />
            ))}
            <div
              className={styles.compoundFill}
              style={{ height: loading ? "0%" : `${stats?.percent ?? 0}%` }}
            />
            {!loading && stats && (
              <span
                className={styles.compoundMarker}
                style={{ bottom: `calc(${stats.percent}% - 5px)` }}
                title={`${stats.percent.toFixed(1)}%`}
              />
            )}
          </div>
          <div className={styles.compoundScale}>
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
        </div>

        <div className={styles.compoundStats}>
          {loading ? (
            <p className={styles.compoundLoading}>加载本金…</p>
          ) : displayPrincipal === null ? (
            <p className={styles.compoundLoading}>暂无仓位本金数据</p>
          ) : (
            <>
              <div className={styles.compoundStatRow}>
                <span className={styles.compoundStatLabel}>当前本金</span>
                <strong className={styles.compoundStatValue}>{currencyFormatter.format(displayPrincipal)}</strong>
              </div>
              {showPreview && principal !== null && (
                <p className={styles.compoundPreviewNote}>
                  链上本金 {currencyFormatter.format(principal)}，含本单盈亏预览
                </p>
              )}
              <div className={styles.compoundStatRow}>
                <span className={styles.compoundStatLabel}>进度</span>
                <strong className={styles.compoundStatValue}>{stats ? `${stats.percent.toFixed(1)}%` : "—"}</strong>
              </div>
              <div className={styles.compoundStatRow}>
                <span className={styles.compoundStatLabel}>等效步数</span>
                <strong className={styles.compoundStatValue}>
                  {stats ? `${stats.stepRounded} / ${COMPOUND_TARGET_STEPS}` : "—"}
                </strong>
              </div>
              <div className={styles.compoundStatRow}>
                <span className={styles.compoundStatLabel}>满进度目标</span>
                <span className={styles.compoundStatMuted}>{currencyFormatter.format(COMPOUND_GOAL_PRINCIPAL)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default CompoundProgressBar;
