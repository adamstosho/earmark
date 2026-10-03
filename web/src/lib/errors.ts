import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  HttpRequestError,
  InsufficientFundsError,
  SwitchChainError,
  TimeoutError,
  UserRejectedRequestError,
  type Abi,
  type Hex,
} from 'viem';
import { earmarkAbi } from '../abi';
import { copy } from '../copy';
import { fromUnix, fullDate } from './dates';
import { usd } from './amounts';

/** ERC-20 errors USDC may raise, decoded alongside Earmark's own. */
const erc20ErrorsAbi = [
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
] as const satisfies Abi;

const decodeAbi = [...earmarkAbi, ...erc20ErrorsAbi] as const;

export interface DecodedError {
  name: string;
  args: readonly unknown[];
}

export interface ErrorContext {
  /** "this week", "today"…: the pocket's period, for OverLimit. */
  period?: string;
  /** Whether the failure happened before anything was sent, or on Arc after sending (the fee was charged). */
  stage?: 'preflight' | 'onchain';
}

function asBigint(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n;
}

/** The message for one of Earmark's custom errors (or a USDC / OpenZeppelin error), filled with its amounts and dates. */
export function contractErrorMessage(name: string, args: readonly unknown[], ctx: ErrorContext = {}): string {
  const e = copy.errors;
  switch (name) {
    case 'NotSponsor':
      return e.notSponsor;
    case 'NotSpender':
      return e.notSpender;
    case 'UnknownPocket':
      return e.unknownPocket;
    case 'InvalidAddress':
      return e.invalidAddress;
    case 'InvalidAmount':
      return e.invalidAmount;
    case 'BadLabel':
      return e.badLabel;
    case 'MemoTooLong':
      return e.memoTooLong;
    case 'BadPeriod':
      return e.badPeriod;
    case 'BadLock':
      return e.badLock;
    case 'LockNotExtended':
      return e.lockNotExtended;
    case 'Locked':
      return e.locked(fullDate(fromUnix(asBigint(args[0]))));
    case 'OverLimit':
      return e.overLimit(usd(asBigint(args[0])), ctx.period ?? copy.period.word('other'));
    case 'InsufficientBalance':
      return e.insufficientBalance(usd(asBigint(args[0])));
    case 'PayeeNotApproved':
      return e.payeeNotApproved;
    case 'TooManyPayees':
      return e.tooManyPayees;
    case 'TooManyPending':
      return e.tooManyPending;
    case 'NotPending':
      return e.notPending;
    case 'FuelOutOfRange':
      return e.fuelOutOfRange;
    case 'BadAppearance':
      return e.badAppearance;
    case 'BadToken':
      return e.badToken;
    case 'ReentrancyGuardReentrantCall':
      return e.reentrant;
    case 'SafeERC20FailedOperation':
      return e.transferFailed;
    case 'SafeCastOverflowedUintDowncast':
      return e.tooLarge;
    case 'ERC20InsufficientBalance':
      return e.walletShort;
    case 'ERC20InsufficientAllowance':
      return e.transferFailed;
    case 'Error':
      return reasonMessage(typeof args[0] === 'string' ? args[0] : '', ctx);
    default:
      return e.unknown;
  }
}

const COMPLIANCE = /blacklist|blocklist|blocked|sanction|denylist/i;

/** Revert strings from USDC itself. */
function reasonMessage(reason: string, ctx: ErrorContext): string {
  if (COMPLIANCE.test(reason)) {
    return ctx.stage === 'onchain' ? copy.errors.complianceSent : copy.errors.compliancePreflight;
  }
  if (/exceeds balance|insufficient balance/i.test(reason)) return copy.errors.walletShort;
  if (/allowance/i.test(reason)) return copy.errors.transferFailed;
  return ctx.stage === 'onchain' ? copy.errors.failedOnArc : copy.errors.unknown;
}

function findRevertData(err: BaseError): Hex | undefined {
  const found = err.walk((e) => {
    const data = (e as { data?: unknown }).data;
    return typeof data === 'string' && data.startsWith('0x') && data.length >= 10;
  });
  const data = (found as { data?: unknown } | null)?.data;
  return typeof data === 'string' ? (data as Hex) : undefined;
}

/** Finds and decodes a revert anywhere in a viem error chain. */
export function decodeRevert(err: unknown): DecodedError | null {
  if (!(err instanceof BaseError)) return null;
  const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (reverted instanceof ContractFunctionRevertedError) {
    if (reverted.data?.errorName) return { name: reverted.data.errorName, args: reverted.data.args ?? [] };
    if (reverted.reason) return { name: 'Error', args: [reverted.reason] };
  }
  const data = findRevertData(err);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: decodeAbi, data });
      return { name: decoded.errorName, args: decoded.args };
    } catch {
      return null;
    }
  }
  return null;
}

function hasCode(err: BaseError, code: number): boolean {
  return (
    err.walk((e) => {
      const c = (e as { code?: unknown }).code;
      return c === code;
    }) !== null
  );
}

/** One plain sentence for anything that can go wrong while talking to the wallet or Arc. */
export function describeError(err: unknown, ctx: ErrorContext = {}): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError) || hasCode(err, 4001)) return copy.errors.walletRejected;
    if (err.walk((e) => e instanceof ChainMismatchError || e instanceof SwitchChainError)) return copy.errors.wrongNetwork;
    const decoded = decodeRevert(err);
    if (decoded) return contractErrorMessage(decoded.name, decoded.args, ctx);
    if (err.walk((e) => e instanceof InsufficientFundsError)) return copy.errors.feeShort;
    if (COMPLIANCE.test(err.message)) {
      return ctx.stage === 'onchain' ? copy.errors.complianceSent : copy.errors.compliancePreflight;
    }
    if (err.walk((e) => e instanceof HttpRequestError || e instanceof TimeoutError)) return copy.errors.unreachable;
    return ctx.stage === 'onchain' ? copy.errors.failedOnArc : copy.errors.unknown;
  }
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    if (code === 4001 || /user rejected|user denied|rejected the request/i.test(err.message)) {
      return copy.errors.walletRejected;
    }
    if (err instanceof TypeError && /fetch|network/i.test(err.message)) return copy.errors.unreachable;
  }
  return copy.errors.unknown;
}

/** True when a failure was the person cancelling in their wallet, which needs no alarming state. */
export function isRejection(err: unknown): boolean {
  return describeError(err) === copy.errors.walletRejected;
}
