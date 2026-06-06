import type { PositionRecord } from "../types.js";
import { getTradeResult } from "./tradeResult.js";

export type PrincipalSnapshot = {
  startPrincipal: number;
  endPrincipal: number | null;
};

/** 按交易时间顺序链式计算每笔记录的开仓本金与平仓后本金 */
export function computePrincipalChain(positions: PositionRecord[]): Map<string, PrincipalSnapshot> {
  if (positions.length === 0) {
    return new Map();
  }

  const sorted = [...positions].sort((a, b) => {
    const byDate = a.tradeDate.localeCompare(b.tradeDate);
    if (byDate !== 0) {
      return byDate;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  const chain = new Map<string, PrincipalSnapshot>();
  let runningPrincipal = sorted[0].principal;

  for (const record of sorted) {
    const startPrincipal = runningPrincipal;
    const tradeResult = getTradeResult(record);
    const endPrincipal = tradeResult ? startPrincipal + tradeResult.profitLoss : null;
    chain.set(record.id, { startPrincipal, endPrincipal });
    if (endPrincipal !== null) {
      runningPrincipal = endPrincipal;
    }
  }

  return chain;
}

export function principalChainForIds(
  allPositions: PositionRecord[],
  ids: string[]
): Record<string, PrincipalSnapshot> {
  const idSet = new Set(ids);
  const fullChain = computePrincipalChain(allPositions);
  const result: Record<string, PrincipalSnapshot> = {};
  for (const id of idSet) {
    const snapshot = fullChain.get(id);
    if (snapshot) {
      result[id] = snapshot;
    }
  }
  return result;
}
