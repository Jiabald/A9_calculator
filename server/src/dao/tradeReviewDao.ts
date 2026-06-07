import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "../db/pool.js";
import type { TradeReviewListItem, TradeReviewRecord } from "../types/tradeReview.js";

interface TradeReviewRow extends RowDataPacket {
  id: string;
  screenshots: string | unknown[];
  strategy: string;
  symbol: string;
  side: "long" | "short";
  entry_mode: string;
  trade_date: string;
  timeframe: string | null;
  entry_reason: string;
  profit_target: string;
  initial_stop_loss: string;
  review_notes: string | null;
  profit_loss: string | null;
  risk_reward: string | null;
  market_cycle: string | null;
  trade_type: string | null;
  execution_confidence: number | null;
  created_at: Date;
  updated_at: Date;
}

function parseScreenshots(value: string | unknown[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToRecord(row: TradeReviewRow): TradeReviewRecord {
  return {
    id: row.id,
    screenshots: parseScreenshots(row.screenshots),
    strategy: row.strategy,
    symbol: row.symbol,
    side: row.side,
    entryMode: row.entry_mode,
    tradeDate: row.trade_date,
    timeframe: row.timeframe ?? undefined,
    entryReason: row.entry_reason,
    profitTarget: row.profit_target,
    initialStopLoss: row.initial_stop_loss,
    reviewNotes: row.review_notes ?? undefined,
    profitLoss: row.profit_loss !== null ? Number(row.profit_loss) : undefined,
    riskReward: row.risk_reward !== null ? Number(row.risk_reward) : undefined,
    marketCycle: row.market_cycle ?? undefined,
    tradeType: row.trade_type ?? undefined,
    executionConfidence: row.execution_confidence ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function rowToListItem(row: TradeReviewRow): TradeReviewListItem {
  const screenshots = parseScreenshots(row.screenshots);
  return {
    id: row.id,
    coverImage: screenshots[0] ?? null,
    strategy: row.strategy,
    symbol: row.symbol,
    side: row.side,
    entryMode: row.entry_mode,
    tradeDate: row.trade_date,
    timeframe: row.timeframe,
    profitLoss: row.profit_loss !== null ? Number(row.profit_loss) : null,
    riskReward: row.risk_reward !== null ? Number(row.risk_reward) : null,
    executionConfidence: row.execution_confidence,
    createdAt: row.created_at.toISOString()
  };
}

function recordToParams(record: TradeReviewRecord) {
  return {
    id: record.id,
    screenshots: JSON.stringify(record.screenshots),
    strategy: record.strategy,
    symbol: record.symbol,
    side: record.side,
    entryMode: record.entryMode,
    tradeDate: record.tradeDate,
    timeframe: record.timeframe ?? null,
    entryReason: record.entryReason,
    profitTarget: record.profitTarget,
    initialStopLoss: record.initialStopLoss,
    reviewNotes: record.reviewNotes ?? null,
    profitLoss: record.profitLoss ?? null,
    riskReward: record.riskReward ?? null,
    marketCycle: record.marketCycle ?? null,
    tradeType: record.tradeType ?? null,
    executionConfidence: record.executionConfidence ?? null,
    createdAt: record.createdAt.replace("T", " ").replace("Z", ""),
    updatedAt: record.updatedAt.replace("T", " ").replace("Z", "")
  };
}

const SELECT_COLUMNS = `
  id, screenshots, strategy, symbol, side, entry_mode, trade_date, timeframe,
  entry_reason, profit_target, initial_stop_loss, review_notes,
  profit_loss, risk_reward, market_cycle, trade_type, execution_confidence,
  created_at, updated_at
`;

export const tradeReviewDao = {
  async count(): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM trade_reviews");
    return Number(rows[0]?.total ?? 0);
  },

  async findPaginated(offset: number, limit: number): Promise<TradeReviewListItem[]> {
    const pool = getPool();
    const [rows] = await pool.query<TradeReviewRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM trade_reviews ORDER BY trade_date DESC, created_at DESC LIMIT :limit OFFSET :offset`,
      { limit, offset }
    );
    return rows.map(rowToListItem);
  },

  async findById(id: string): Promise<TradeReviewRecord | null> {
    const pool = getPool();
    const [rows] = await pool.query<TradeReviewRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM trade_reviews WHERE id = :id`,
      { id }
    );
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  },

  async insert(record: TradeReviewRecord): Promise<void> {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO trade_reviews (
        id, screenshots, strategy, symbol, side, entry_mode, trade_date, timeframe,
        entry_reason, profit_target, initial_stop_loss, review_notes,
        profit_loss, risk_reward, market_cycle, trade_type, execution_confidence,
        created_at, updated_at
      ) VALUES (
        :id, :screenshots, :strategy, :symbol, :side, :entryMode, :tradeDate, :timeframe,
        :entryReason, :profitTarget, :initialStopLoss, :reviewNotes,
        :profitLoss, :riskReward, :marketCycle, :tradeType, :executionConfidence,
        :createdAt, :updatedAt
      )`,
      recordToParams(record)
    );
  },

  async update(record: TradeReviewRecord): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE trade_reviews SET
        screenshots = :screenshots,
        strategy = :strategy,
        symbol = :symbol,
        side = :side,
        entry_mode = :entryMode,
        trade_date = :tradeDate,
        timeframe = :timeframe,
        entry_reason = :entryReason,
        profit_target = :profitTarget,
        initial_stop_loss = :initialStopLoss,
        review_notes = :reviewNotes,
        profit_loss = :profitLoss,
        risk_reward = :riskReward,
        market_cycle = :marketCycle,
        trade_type = :tradeType,
        execution_confidence = :executionConfidence,
        updated_at = :updatedAt
      WHERE id = :id`,
      recordToParams(record)
    );
    return result.affectedRows > 0;
  },

  async deleteById(id: string): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM trade_reviews WHERE id = :id", { id });
    return result.affectedRows > 0;
  }
};
