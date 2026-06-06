import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "../db/pool.js";
import { DEFAULT_PRINCIPAL } from "../types.js";
import type { PositionInput, PositionRecord } from "../types.js";

interface PositionRow extends RowDataPacket {
  id: string;
  symbol: string;
  side: "long" | "short";
  entry_price: string;
  stop_loss: string;
  take_profit: string | null;
  leverage: string;
  position_size: string;
  position_value: string;
  risk_amount: string;
  loss_ratio: string;
  open_fee_rate: string;
  close_fee_rate: string;
  principal: string;
  funding_fee: string;
  close_price: string | null;
  notes: string | null;
  trade_date: string;
  created_at: Date;
  updated_at: Date;
}

function toNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return Number(value);
}

function rowToRecord(row: PositionRow): PositionRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    entryPrice: Number(row.entry_price),
    stopLoss: Number(row.stop_loss),
    takeProfit: toNumber(row.take_profit),
    leverage: Number(row.leverage),
    positionSize: Number(row.position_size),
    positionValue: Number(row.position_value),
    riskAmount: Number(row.risk_amount),
    lossRatio: Number(row.loss_ratio),
    openFeeRate: Number(row.open_fee_rate),
    closeFeeRate: Number(row.close_fee_rate),
    principal: Number(row.principal) || DEFAULT_PRINCIPAL,
    fundingFee: Number(row.funding_fee) || 0,
    closePrice: toNumber(row.close_price),
    notes: row.notes ?? "",
    tradeDate: row.trade_date,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function recordToParams(record: PositionRecord | (PositionInput & { id: string; createdAt: string; updatedAt: string })) {
  return {
    id: record.id,
    symbol: record.symbol,
    side: record.side,
    entryPrice: record.entryPrice,
    stopLoss: record.stopLoss,
    takeProfit: record.takeProfit ?? null,
    leverage: record.leverage,
    positionSize: record.positionSize,
    positionValue: record.positionValue,
    riskAmount: record.riskAmount,
    lossRatio: record.lossRatio,
    openFeeRate: record.openFeeRate,
    closeFeeRate: record.closeFeeRate,
    principal: record.principal,
    fundingFee: record.fundingFee,
    closePrice: record.closePrice ?? null,
    notes: record.notes ?? null,
    tradeDate: record.tradeDate,
    createdAt: record.createdAt.replace("T", " ").replace("Z", ""),
    updatedAt: record.updatedAt.replace("T", " ").replace("Z", "")
  };
}

const SELECT_COLUMNS = `
  id, symbol, side, entry_price, stop_loss, take_profit, leverage,
  position_size, position_value, risk_amount, loss_ratio,
  open_fee_rate, close_fee_rate, principal, funding_fee, close_price,
  notes, trade_date, created_at, updated_at
`;

export const positionDao = {
  async findLatest(): Promise<PositionRecord | null> {
    const pool = getPool();
    const [rows] = await pool.query<PositionRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM positions ORDER BY trade_date DESC, created_at DESC LIMIT 1`
    );
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  },

  async findAll(): Promise<PositionRecord[]> {
    const pool = getPool();
    const [rows] = await pool.query<PositionRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM positions ORDER BY trade_date DESC, created_at DESC`
    );
    return rows.map(rowToRecord);
  },

  async count(): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM positions");
    return Number(rows[0]?.total ?? 0);
  },

  async findPaginated(offset: number, limit: number): Promise<PositionRecord[]> {
    const pool = getPool();
    const [rows] = await pool.query<PositionRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM positions ORDER BY trade_date DESC, created_at DESC LIMIT :limit OFFSET :offset`,
      { limit, offset }
    );
    return rows.map(rowToRecord);
  },

  async findById(id: string): Promise<PositionRecord | null> {
    const pool = getPool();
    const [rows] = await pool.query<PositionRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM positions WHERE id = :id`,
      { id }
    );
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  },

  async insert(record: PositionRecord): Promise<void> {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO positions (
        id, symbol, side, entry_price, stop_loss, take_profit, leverage,
        position_size, position_value, risk_amount, loss_ratio,
        open_fee_rate, close_fee_rate, principal, funding_fee, close_price,
        notes, trade_date, created_at, updated_at
      ) VALUES (
        :id, :symbol, :side, :entryPrice, :stopLoss, :takeProfit, :leverage,
        :positionSize, :positionValue, :riskAmount, :lossRatio,
        :openFeeRate, :closeFeeRate, :principal, :fundingFee, :closePrice,
        :notes, :tradeDate, :createdAt, :updatedAt
      )`,
      recordToParams(record)
    );
  },

  async update(record: PositionRecord): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE positions SET
        symbol = :symbol,
        side = :side,
        entry_price = :entryPrice,
        stop_loss = :stopLoss,
        take_profit = :takeProfit,
        leverage = :leverage,
        position_size = :positionSize,
        position_value = :positionValue,
        risk_amount = :riskAmount,
        loss_ratio = :lossRatio,
        open_fee_rate = :openFeeRate,
        close_fee_rate = :closeFeeRate,
        principal = :principal,
        funding_fee = :fundingFee,
        close_price = :closePrice,
        notes = :notes,
        trade_date = :tradeDate,
        updated_at = :updatedAt
      WHERE id = :id`,
      recordToParams(record)
    );
    return result.affectedRows > 0;
  },

  async deleteById(id: string): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM positions WHERE id = :id",
      { id }
    );
    return result.affectedRows > 0;
  }
};
