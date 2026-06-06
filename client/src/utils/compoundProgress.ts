import { DEFAULT_PRINCIPAL } from "../types";

/** 复利起点本金（USD） */
export const COMPOUND_BASE_PRINCIPAL = DEFAULT_PRINCIPAL;

/** 每步复利增长率（10% → 1.1） */
export const COMPOUND_RATE = 0.1;

/** 满进度对应复利步数 */
export const COMPOUND_TARGET_STEPS = 100;

export function principalAtCompoundStep(step: number): number {
  return COMPOUND_BASE_PRINCIPAL * (1 + COMPOUND_RATE) ** step;
}

export const COMPOUND_GOAL_PRINCIPAL = principalAtCompoundStep(COMPOUND_TARGET_STEPS);

/** 由当前本金反推等效复利步数（连续近似，未四舍五入到整数步） */
export function compoundStepFromPrincipal(principal: number): number {
  if (!Number.isFinite(principal) || principal <= COMPOUND_BASE_PRINCIPAL) {
    return 0;
  }
  if (principal >= COMPOUND_GOAL_PRINCIPAL) {
    return COMPOUND_TARGET_STEPS;
  }
  return Math.log(principal / COMPOUND_BASE_PRINCIPAL) / Math.log(1 + COMPOUND_RATE);
}

/** 0–100，对应 100 次 10% 复利 */
export function compoundProgressPercent(principal: number): number {
  const step = compoundStepFromPrincipal(principal);
  return Math.min(100, Math.max(0, (step / COMPOUND_TARGET_STEPS) * 100));
}
