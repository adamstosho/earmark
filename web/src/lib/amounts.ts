import { formatUnits, parseUnits } from 'viem';
import { USDC_DECIMALS } from '../chains';
import { formatNaira, formatUSDC } from '../ds/typed';

/** 1 USDC in base units. */
export const ONE_USDC = 10n ** BigInt(USDC_DECIMALS);

const INPUT = /^(\d{1,12})(?:\.(\d{0,2}))?$/;

/**
 * Parses what a person typed ("12", "12.5", "12.50") into USDC base units. At most two decimals, as the design
 * system's inputs allow. Returns null for empty or malformed input. Never uses floating point.
 */
export function parseUsdc(input: string): bigint | null {
  const text = input.trim();
  if (text === '' || text === '.') return null;
  if (!INPUT.test(text)) return null;
  return parseUnits(text.endsWith('.') ? text.slice(0, -1) : text, USDC_DECIMALS);
}

/** Base units to a number for display components (Money, AmountInput). The only bigint-to-number edge (D13). */
export function toDisplay(value: bigint): number {
  return Number(formatUnits(value, USDC_DECIMALS));
}

/** Base units to an input string with at most two decimals, rounded down so it never exceeds `value`. */
export function toInput(value: bigint): string {
  const cents = value / 10_000n;
  const whole = cents / 100n;
  const frac = cents % 100n;
  return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(2, '0')}`;
}

/** "$1,240.50"; `sign` gives "+$12.50" or "−$12.50". */
export function usd(value: bigint, sign?: 'in' | 'out'): string {
  return formatUSDC(toDisplay(value), sign ? { sign } : {});
}

/** "≈ ₦18,750" for an amount at the given rate (naira per USDC), or null without a rate. */
export function naira(value: bigint, rate: number | undefined): string | null {
  if (rate === undefined || !(rate > 0)) return null;
  return formatNaira(toDisplay(value) * rate);
}

export function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
