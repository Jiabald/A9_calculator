import { readFile } from "node:fs/promises";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import { getPool } from "../src/db/pool.js";
import { initDatabase } from "../src/db/init.js";
import { positionDao } from "../src/dao/positionDao.js";
import { DEFAULT_PRINCIPAL, type PositionRecord } from "../src/types.js";
import { getCurrentPrincipalFromRecord, getTradeResult } from "../src/utils/tradeResult.js";

dotenv.config();

const CSV_PATH =
  "/Users/laijiajian/Downloads/NDg2NjA1NjU=~2026-05-02~2026-06-02~8~f34185c4ca5d58e781d4f14173d41e5d_PositionHistory/欧易持仓历史__2026-05-02~2026-06-02~8~f34185c4ca5d58e781d4f14173d41e5d.csv";

const CUTOFF = new Date("2026-05-25T12:44:00+08:00");

type CsvRow = {
  createdAt: Date;
  updatedAt: Date;
  indexSymbol: string;
  product: string;
  side: "long" | "short";
  leverage: number;
  closedSize: number;
  entryPrice: number;
  closePrice: number;
  profit: number;
  returnRate: number;
  totalFee: number;
  fundingFee: number;
  closeType: string;
  contractValue: number;
};

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(stripBom(current));
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(stripBom(current));
  return cells;
}

function parseDate(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  return new Date(`${normalized}+08:00`);
}

function toIso(date: Date): string {
  return date.toISOString();
}

function toMysqlDatetime(iso: string): string {
  return iso.replace("T", " ").replace("Z", "");
}

function toTradeDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function symbolFromIndex(indexSymbol: string): string {
  return indexSymbol.replace(/-/g, "").toUpperCase();
}

function sideFromText(value: string): "long" | "short" {
  return value.includes("多") ? "long" : "short";
}

function deriveStopLoss(side: "long" | "short", entryPrice: number, closePrice: number): number {
  if (side === "long") {
    return closePrice <= entryPrice ? closePrice : entryPrice * 0.99;
  }
  return closePrice >= entryPrice ? closePrice : entryPrice * 1.01;
}

function deriveFeeRates(totalFee: number, positionValue: number, closeValue: number): { openFeeRate: number; closeFeeRate: number } {
  const feeLoss = Math.abs(totalFee);
  if (feeLoss <= 0 || positionValue <= 0 || closeValue <= 0) {
    return { openFeeRate: 0.05, closeFeeRate: 0.05 };
  }

  const openFeeRate = (feeLoss * 0.5 / positionValue) * 100;
  const closeFeeRate = (feeLoss * 0.5 / closeValue) * 100;
  return {
    openFeeRate: Math.max(0.0001, openFeeRate),
    closeFeeRate: Math.max(0.0001, closeFeeRate)
  };
}

function calcLossRatioPercent(
  entryPrice: number,
  stopLoss: number,
  openFeeRate: number,
  closeFeeRate: number
): number {
  const priceLossRatio = Math.abs(entryPrice - stopLoss) / entryPrice;
  const feeRatio = (openFeeRate + closeFeeRate) / 100;
  return (priceLossRatio + feeRatio) * 100;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = lines.findIndex((line) => line.includes("仓位创建时间"));
  if (headerIndex < 0) {
    throw new Error("CSV 缺少表头");
  }

  const rows: CsvRow[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = parseCsvLine(line);
    if (cells.length < 20) continue;

    const createdAt = parseDate(cells[0]);
    if (createdAt < CUTOFF) continue;

    const closedSize = Number(cells[9]);
    const entryPrice = Number(cells[10]);
    const closePrice = Number(cells[11]);
    const contractValue = Number(cells[19]);

    if (!Number.isFinite(closedSize) || !Number.isFinite(entryPrice) || !Number.isFinite(closePrice)) {
      continue;
    }

    rows.push({
      createdAt,
      updatedAt: parseDate(cells[1]),
      indexSymbol: cells[3],
      product: cells[4],
      side: sideFromText(cells[6]),
      leverage: Number(cells[7]),
      closedSize,
      entryPrice,
      closePrice,
      profit: Number(cells[13]),
      returnRate: Number(cells[14]),
      totalFee: Number(cells[15]),
      fundingFee: Number(cells[16]),
      closeType: cells[17],
      contractValue
    });
  }

  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function rowToRecord(row: CsvRow, principal: number): PositionRecord {
  const positionSize = row.closedSize * row.contractValue;
  const positionValue = positionSize * row.entryPrice;
  const closeValue = positionSize * row.closePrice;
  const stopLoss = deriveStopLoss(row.side, row.entryPrice, row.closePrice);
  const { openFeeRate, closeFeeRate } = deriveFeeRates(row.totalFee, positionValue, closeValue);
  const lossRatio = calcLossRatioPercent(row.entryPrice, stopLoss, openFeeRate, closeFeeRate);
  const riskAmount = (positionValue * lossRatio) / 100;
  const createdAt = toIso(row.createdAt);
  const updatedAt = toIso(row.updatedAt);

  return {
    id: nanoid(),
    symbol: symbolFromIndex(row.indexSymbol),
    side: row.side,
    entryPrice: row.entryPrice,
    stopLoss,
    takeProfit: undefined,
    leverage: row.leverage,
    positionSize,
    positionValue,
    riskAmount,
    lossRatio,
    openFeeRate,
    closeFeeRate,
    principal,
    fundingFee: row.fundingFee,
    closePrice: row.closePrice,
    notes: `OKX导入 | ${row.product} | ${row.closeType} | 收益 ${row.profit.toFixed(4)} USDT`,
    tradeDate: toTradeDate(row.createdAt),
    createdAt,
    updatedAt
  };
}

async function getStartingPrincipal(): Promise<number> {
  const latest = await positionDao.findLatest();
  if (!latest) {
    return DEFAULT_PRINCIPAL;
  }
  return getCurrentPrincipalFromRecord(latest);
}

async function main() {
  await initDatabase();
  const csv = await readFile(CSV_PATH, "utf8");
  const rows = parseCsv(csv);

  if (rows.length === 0) {
    console.log("没有符合筛选条件的记录");
    return;
  }

  let principal = await getStartingPrincipal();
  const records = rows.map((row) => {
    const record = rowToRecord(row, principal);
    const tradeResult = getTradeResult(record);
    if (tradeResult) {
      principal = record.principal + tradeResult.profitLoss;
    }
    return record;
  });

  const pool = getPool();
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
          fundingFee: record.fundingFee,
          closePrice: record.closePrice ?? null,
          notes: record.notes ?? null,
          tradeDate: record.tradeDate,
          createdAt: toMysqlDatetime(record.createdAt),
          updatedAt: toMysqlDatetime(record.updatedAt)
        }
      );
    }
    await connection.commit();
    console.log(`已导入 ${records.length} 条记录（>= 2026-05-25 12:44:00 UTC+8）`);
    console.log(`起始本金: ${records[0].principal.toFixed(2)} -> 结束本金: ${principal.toFixed(2)}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
