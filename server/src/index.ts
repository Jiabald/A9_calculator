import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import { readPositions, writePositions } from "./storage.js";
import type { PositionInput, PositionRecord, TradeSide } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRequiredNumber(input: Partial<PositionInput>, field: keyof PositionInput) {
  const value = input[field];
  if (!isFiniteNumber(value)) {
    throw new Error(`${String(field)} 必须是有效数字`);
  }
  return value;
}

function validatePositionInput(body: unknown): PositionInput {
  const input = body as Partial<PositionInput>;

  if (typeof input.symbol !== "string" || input.symbol.trim().length === 0) {
    throw new Error("品种不能为空");
  }

  if (input.side !== "long" && input.side !== "short") {
    throw new Error("方向必须是 long 或 short");
  }

  if (input.takeProfit !== undefined && !isFiniteNumber(input.takeProfit)) {
    throw new Error("takeProfit 必须是有效数字");
  }

  if (input.closePrice !== undefined && !isFiniteNumber(input.closePrice)) {
    throw new Error("closePrice 必须是有效数字");
  }

  if (typeof input.tradeDate !== "string" || input.tradeDate.trim().length === 0) {
    throw new Error("日期不能为空");
  }

  return {
    symbol: input.symbol.trim().toUpperCase(),
    side: input.side as TradeSide,
    entryPrice: getRequiredNumber(input, "entryPrice"),
    stopLoss: getRequiredNumber(input, "stopLoss"),
    takeProfit: input.takeProfit,
    leverage: getRequiredNumber(input, "leverage"),
    positionSize: getRequiredNumber(input, "positionSize"),
    positionValue: getRequiredNumber(input, "positionValue"),
    riskAmount: getRequiredNumber(input, "riskAmount"),
    lossRatio: getRequiredNumber(input, "lossRatio"),
    openFeeRate: getRequiredNumber(input, "openFeeRate"),
    closeFeeRate: getRequiredNumber(input, "closeFeeRate"),
    closePrice: input.closePrice,
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
    tradeDate: input.tradeDate
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/positions", async (_req, res, next) => {
  try {
    const positions = await readPositions();
    res.json(positions.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/positions", async (req, res, next) => {
  try {
    const input = validatePositionInput(req.body);
    const now = new Date().toISOString();
    const record: PositionRecord = {
      id: nanoid(),
      ...input,
      createdAt: now,
      updatedAt: now
    };
    const positions = await readPositions();
    positions.unshift(record);
    await writePositions(positions);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

app.put("/api/positions/:id", async (req, res, next) => {
  try {
    const input = validatePositionInput(req.body);
    const positions = await readPositions();
    const index = positions.findIndex((position) => position.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ message: "仓位记录不存在" });
      return;
    }

    const updated: PositionRecord = {
      ...positions[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    positions[index] = updated;
    await writePositions(positions);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/positions/:id", async (req, res, next) => {
  try {
    const positions = await readPositions();
    const nextPositions = positions.filter((position) => position.id !== req.params.id);

    if (nextPositions.length === positions.length) {
      res.status(404).json({ message: "仓位记录不存在" });
      return;
    }

    await writePositions(nextPositions);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ message: error.message || "请求处理失败" });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
