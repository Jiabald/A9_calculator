import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";
import type { PositionRecord } from "../types.js";
import { getPool } from "./pool.js";

const CREATE_DATABASE_SQL = `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_POSITIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(21) PRIMARY KEY,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('long', 'short') NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  stop_loss DECIMAL(20, 8) NOT NULL,
  take_profit DECIMAL(20, 8) NULL,
  leverage DECIMAL(10, 2) NOT NULL,
  position_size DECIMAL(20, 12) NOT NULL,
  position_value DECIMAL(20, 8) NOT NULL,
  risk_amount DECIMAL(20, 8) NOT NULL,
  loss_ratio DECIMAL(20, 8) NOT NULL,
  open_fee_rate DECIMAL(10, 6) NOT NULL,
  close_fee_rate DECIMAL(10, 6) NOT NULL,
  principal DECIMAL(20, 8) NOT NULL,
  funding_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
  close_price DECIMAL(20, 8) NULL,
  notes TEXT NULL,
  trade_date VARCHAR(10) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_trade_date (trade_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const CREATE_TRADE_REVIEWS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS trade_reviews (
  id VARCHAR(21) PRIMARY KEY,
  screenshots JSON NOT NULL,
  strategy VARCHAR(128) NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  side ENUM('long', 'short') NOT NULL,
  entry_mode VARCHAR(64) NOT NULL,
  trade_date VARCHAR(10) NOT NULL,
  timeframe VARCHAR(16) NULL,
  entry_reason TEXT NOT NULL,
  profit_target VARCHAR(300) NOT NULL,
  initial_stop_loss VARCHAR(300) NOT NULL,
  review_notes TEXT NULL,
  profit_loss DECIMAL(20, 4) NULL,
  risk_reward DECIMAL(10, 4) NULL,
  market_cycle VARCHAR(64) NULL,
  trade_type VARCHAR(64) NULL,
  execution_confidence TINYINT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_trade_reviews_date (trade_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function migrateFromJsonIfEmpty(): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM positions");
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) {
    return;
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const dataFile = resolve(currentDir, "../../data/positions.json");

  let records: PositionRecord[];
  try {
    const raw = await readFile(dataFile, "utf8");
    records = JSON.parse(raw) as PositionRecord[];
  } catch {
    return;
  }

  if (!Array.isArray(records) || records.length === 0) {
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const record of records) {
      await connection.execute(
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
        {
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
          fundingFee: record.fundingFee ?? 0,
          closePrice: record.closePrice ?? null,
          notes: record.notes ?? null,
          tradeDate: record.tradeDate,
          createdAt: toMysqlDatetime(record.createdAt),
          updatedAt: toMysqlDatetime(record.updatedAt)
        }
      );
    }
    await connection.commit();
    console.log(`已从 positions.json 迁移 ${records.length} 条记录到 MySQL`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function toMysqlDatetime(iso: string): string {
  return iso.replace("T", " ").replace("Z", "");
}

export async function initDatabase(): Promise<void> {
  const bootstrap = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true
  });

  try {
    await bootstrap.query(CREATE_DATABASE_SQL);
    await bootstrap.query(`USE \`${dbConfig.database}\``);
    await bootstrap.query(CREATE_POSITIONS_TABLE_SQL);
    await bootstrap.query(CREATE_TRADE_REVIEWS_TABLE_SQL);
  } finally {
    await bootstrap.end();
  }

  const pool = getPool();
  await pool.query(CREATE_POSITIONS_TABLE_SQL);
  await pool.query(CREATE_TRADE_REVIEWS_TABLE_SQL);
  await migrateFromJsonIfEmpty();
}
