import { maxBig } from './amounts';

// D6 fees and D7 gas limits. Arc drops any write offering less than 20 gwei (A2), and eth_estimateGas can fail for
// USDC writes (A3), so every write carries explicit fees and a fallback limit.

export const GWEI = 1_000_000_000n;
export const PRIORITY_FEE = GWEI;
const FLOOR_MAX_FEE = 25n * GWEI;

/** maxFeePerGas = max(25 gwei, 2 x base fee + 1 gwei); tip = 1 gwei. */
export function feeCaps(baseFee: bigint): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  return { maxFeePerGas: maxBig(FLOOR_MAX_FEE, 2n * baseFee + GWEI), maxPriorityFeePerGas: PRIORITY_FEE };
}

/** Estimated gas plus 20%, rounded up. */
export function withHeadroom(estimate: bigint): bigint {
  return (estimate * 120n + 99n) / 100n;
}

/**
 * Fallback limits: the measured worst case (10 payees, 32-byte label, 64-byte memo) plus 30%, never below the PRD's
 * floors. Source: docs/GAS.md, DECISIONS C37. C56 raised `fund` to 175,000.
 */
export const FALLBACK_GAS = {
  approve: 100_000n,
  createPocket: 1_225_000n,
  fund: 175_000n,
  spend: 250_000n,
  request: 455_000n,
  approveRequest: 200_000n,
  declineRequest: 95_000n,
  withdraw: 130_000n,
  extendLock: 85_000n,
  setPayee: 165_000n,
  setLimit: 105_000n,
  cancelRequest: 95_000n,
} as const;

export type WriteName = keyof typeof FALLBACK_GAS;

/** Typical gas per write (docs/GAS.md), used only for the fee preview on the New pocket form. */
export const TYPICAL_GAS = {
  approve: 60_000n,
  createPocketBase: 380_000n,
  perPayee: 50_000n,
} as const;
