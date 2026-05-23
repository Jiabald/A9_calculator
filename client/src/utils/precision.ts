import NP from "number-precision";

/** 关闭超大数边界检查，避免合约价格/数量计算误报 */
NP.enableBoundaryChecking(false);

export function add(...nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => NP.plus(acc, n), 0);
}

export function sub(a: number, b: number): number {
  return NP.minus(a, b);
}

export function mul(...nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.slice(1).reduce((acc, n) => NP.times(acc, n), nums[0]);
}

export function div(a: number, b: number): number {
  if (b === 0) return 0;
  return NP.divide(a, b);
}

export function round(value: number, digits: number): number {
  return NP.round(value, digits);
}

export function strip(value: number): number {
  return NP.strip(value);
}

/** value * (percent / 100) */
export function percentOf(value: number, percent: number): number {
  return mul(value, div(percent, 100));
}

/** (numerator / denominator) * 100 */
export function ratioToPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return mul(div(numerator, denominator), 100);
}

export function absDiff(a: number, b: number): number {
  return strip(Math.abs(sub(a, b)));
}
