import type { Address } from 'viem';
import { earmarkAbi } from '../abi';
import type { AppEnv } from '../app/env';
import type { PeriodKind } from '../copy';
import { decodeRevert } from '../lib/errors';
import { withRetry } from '../lib/rpc';

export interface PocketView {
  id: bigint;
  label: string;
  icon: number;
  hue: number;
  sponsor: Address;
  spender: Address;
  balance: bigint;
  limit: bigint;
  /** Spent in the current period, after a virtual period roll. */
  spent: bigint;
  /** What the spender can pay now without asking (contract `available`, D5). */
  available: bigint;
  fuelTarget: bigint;
  fuelCap: bigint;
  periodLength: bigint;
  periodKind: PeriodKind;
  /** Start of the current period (Unix seconds), after a virtual roll. */
  periodStart: bigint;
  /** When the allowance next resets (Unix seconds). */
  nextReset: bigint;
  lockUntil: bigint;
  lastEventBlock: bigint;
  payeeOnly: boolean;
  pending: bigint;
}

export interface RequestView {
  id: bigint;
  pocketId: bigint;
  to: Address;
  amount: bigint;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  memo: string;
}

export interface Roles {
  sponsorIds: bigint[];
  spenderIds: bigint[];
}

const DAY = 86_400n;

export function periodKind(seconds: bigint): PeriodKind {
  if (seconds === DAY) return 'day';
  if (seconds === 7n * DAY) return 'week';
  if (seconds === 30n * DAY) return 'month';
  return 'other';
}

export const PERIOD_SECONDS: Record<'day' | 'week' | 'month', bigint> = { day: DAY, week: 7n * DAY, month: 30n * DAY };

const STATUS: RequestView['status'][] = ['pending', 'pending', 'approved', 'declined', 'cancelled'];

type RawPocket = {
  sponsor: Address;
  payeeOnly: boolean;
  icon: number;
  hue: number;
  spender: Address;
  balance: bigint;
  limitPerPeriod: bigint;
  spentInPeriod: bigint;
  fuelTarget: bigint;
  fuelCapPerPeriod: bigint;
  fuelUsedInPeriod: bigint;
  periodLength: bigint;
  periodStart: bigint;
  lockUntil: bigint;
  lastEventBlock: bigint;
  label: string;
};

export function toPocketView(id: bigint, raw: RawPocket, available: bigint, pending: bigint, nowSeconds: bigint): PocketView {
  let start = raw.periodStart;
  let spent = raw.spentInPeriod;
  if (raw.periodLength > 0n && nowSeconds >= start + raw.periodLength) {
    start = start + ((nowSeconds - start) / raw.periodLength) * raw.periodLength;
    spent = 0n;
  }
  return {
    id,
    label: raw.label,
    icon: raw.icon,
    hue: raw.hue,
    sponsor: raw.sponsor,
    spender: raw.spender,
    balance: raw.balance,
    limit: raw.limitPerPeriod,
    spent,
    available,
    fuelTarget: raw.fuelTarget,
    fuelCap: raw.fuelCapPerPeriod,
    periodLength: raw.periodLength,
    periodKind: periodKind(raw.periodLength),
    periodStart: start,
    nextReset: start + raw.periodLength,
    lockUntil: raw.lockUntil,
    lastEventBlock: raw.lastEventBlock,
    payeeOnly: raw.payeeOnly,
    pending,
  };
}

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

/** One pocket, or null when it does not exist. */
export async function fetchPocket(env: AppEnv, id: bigint): Promise<PocketView | null> {
  const address = env.config.pockets;
  try {
    const [raw, available, pending] = await withRetry(() =>
      Promise.all([
        env.client.readContract({ address, abi: earmarkAbi, functionName: 'getPocket', args: [id] }),
        env.client.readContract({ address, abi: earmarkAbi, functionName: 'available', args: [id] }),
        env.client.readContract({ address, abi: earmarkAbi, functionName: 'pendingCount', args: [id] }),
      ]),
    );
    return toPocketView(id, raw, available, pending, nowSeconds());
  } catch (err) {
    if (decodeRevert(err)?.name === 'UnknownPocket') return null;
    throw err;
  }
}

export async function fetchPockets(env: AppEnv, ids: readonly bigint[]): Promise<PocketView[]> {
  const found = await Promise.all(ids.map((id) => fetchPocket(env, id)));
  return found.filter((p): p is PocketView => p !== null);
}

export async function fetchRoles(env: AppEnv, account: Address): Promise<Roles> {
  const address = env.config.pockets;
  const [sponsorIds, spenderIds] = await withRetry(() =>
    Promise.all([
      env.client.readContract({ address, abi: earmarkAbi, functionName: 'pocketsOfSponsor', args: [account] }),
      env.client.readContract({ address, abi: earmarkAbi, functionName: 'pocketsOfSpender', args: [account] }),
    ]),
  );
  return { sponsorIds: [...sponsorIds], spenderIds: [...spenderIds] };
}

export async function fetchPayees(env: AppEnv, id: bigint): Promise<Address[]> {
  const list = await withRetry(() =>
    env.client.readContract({ address: env.config.pockets, abi: earmarkAbi, functionName: 'payeesOf', args: [id] }),
  );
  return [...list];
}

export async function fetchRequests(env: AppEnv, ids: readonly bigint[]): Promise<RequestView[]> {
  const address = env.config.pockets;
  const raws = await withRetry(() =>
    Promise.all(ids.map((id) => env.client.readContract({ address, abi: earmarkAbi, functionName: 'getRequest', args: [id] }))),
  );
  return raws.map((r, i) => ({
    id: ids[i] ?? 0n,
    pocketId: r.pocketId,
    to: r.to,
    amount: r.amount,
    status: STATUS[r.status] ?? 'pending',
    memo: r.memo,
  }));
}

/** Requests waiting on a pocket, newest first. Reads from the newest request back until all pending ones are found. */
export async function fetchPendingRequests(env: AppEnv, pocket: PocketView): Promise<RequestView[]> {
  if (pocket.pending === 0n) return [];
  const ids = await withRetry(() =>
    env.client.readContract({ address: env.config.pockets, abi: earmarkAbi, functionName: 'requestsOf', args: [pocket.id] }),
  );
  const newestFirst = [...ids].reverse();
  const out: RequestView[] = [];
  for (let i = 0; i < newestFirst.length && BigInt(out.length) < pocket.pending; i += 25) {
    const batch = await fetchRequests(env, newestFirst.slice(i, i + 25));
    out.push(...batch.filter((r) => r.status === 'pending'));
  }
  return out;
}
