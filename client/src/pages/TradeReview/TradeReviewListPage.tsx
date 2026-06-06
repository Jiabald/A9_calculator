import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pagination } from "tdesign-react";
import { fetchTradeReviews } from "../../api";
import type { TradeReviewListItem } from "../../types";
import styles from "./TradeReview.module.css";

const DEFAULT_PAGE_SIZE = 20;

function formatPl(value: number | null) {
  if (value === null) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function plClass(value: number | null) {
  if (value === null) return "";
  if (value > 0) return styles.plPositive;
  if (value < 0) return styles.plNegative;
  return "";
}

function TradeReviewListPage() {
  const [items, setItems] = useState<TradeReviewListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("正在加载复盘记录...");

  const loadReviews = useCallback(async (targetPage = page, targetPageSize = pageSize) => {
    try {
      const data = await fetchTradeReviews({ page: targetPage, pageSize: targetPageSize });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
      setStatus(data.total ? "" : "暂无复盘记录");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加载失败");
    }
  }, [page, pageSize]);

  useEffect(() => {
    void loadReviews(page, pageSize);
  }, [page, pageSize, loadReviews]);

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Review</p>
          <h1>交易复盘</h1>
          <p className="hero-text">记录思路、截图与执行细节，方便回顾每一笔交易的得失。</p>
        </div>
        <Link className="primary-button hero-action" to="/reviews/new">
          记录复盘
        </Link>
      </section>

      <section className={`panel ${styles.recordsPanel}`}>
        <div className="panel-heading">
          <h2>复盘列表</h2>
          {status && <span className="status">{status}</span>}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>封面</th>
                <th>策略</th>
                <th>标的</th>
                <th>方向</th>
                <th>入场模式</th>
                <th>交易日期</th>
                <th>周期</th>
                <th>盈亏</th>
                <th>盈亏比 R</th>
                <th>信心</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.coverCell}>
                    {item.coverImage ? (
                      <img className={styles.coverThumb} src={item.coverImage} alt="" />
                    ) : (
                      <span className={styles.coverPlaceholder}>无图</span>
                    )}
                  </td>
                  <td>{item.strategy}</td>
                  <td>{item.symbol}</td>
                  <td className={item.side === "long" ? styles.sideLong : styles.sideShort}>
                    {item.side === "long" ? "做多" : "做空"}
                  </td>
                  <td>{item.entryMode}</td>
                  <td>{item.tradeDate}</td>
                  <td>{item.timeframe ?? "-"}</td>
                  <td className={plClass(item.profitLoss)}>{formatPl(item.profitLoss)}</td>
                  <td>{item.riskReward !== null ? `${item.riskReward}R` : "-"}</td>
                  <td>{item.executionConfidence ?? "-"}</td>
                  <td>
                    <div className={styles.actionGroup}>
                      <Link className="pill-button" to={`/reviews/${item.id}`}>
                        查看详情
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={11} className={styles.emptyCell}>
                    还没有复盘记录，点击右上角「记录复盘」开始记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className={styles.paginationWrap}>
            <Pagination
              total={total}
              current={page}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50]}
              showJumper
              onChange={(pageInfo) => {
                setPage(pageInfo.current);
                setPageSize(pageInfo.pageSize);
              }}
            />
          </div>
        )}
      </section>
    </>
  );
}

export default TradeReviewListPage;
