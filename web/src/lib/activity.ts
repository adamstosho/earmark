import { formatLog, numberToHex, pad, parseEventLogs, type Address, type Hex, type RpcLog } from 'viem';
import { earmarkAbi } from '../abi';
import { sleep } from './rpc';

// The activity feed (PRD Section 8). No indexer and no range scans: each pocket's history is rebuilt by walking the
// `prevEventBlock` pointers one block at a time, and new events arrive through a 2-second poll. Only Earmark's own
// events are read, never USDC Transfer logs (A7), and the feed is ordered by block number then log index (A5).

export type EarmarkEvent = ReturnType<typeof parseEventLogs<typeof earmarkAbi>>[number];

export interface FeedEvent {
  /** `${txHash}:${logIndex}`: unique per log, used to remove duplicates. */
  key: string;
  event: EarmarkEvent;
  pocketId: bigint;
  blockNumber: bigint;
  logIndex: number;
  txHash: Hex;
  /** Block time in Unix seconds, when the RPC returned it. */
  timestamp: bigint | null;
}

/** Where logs come from. Injected so the walk can be tested without a network. */
export interface LogSource {
  /** Earmark logs in one block for one pocket. */
  logsInBlock(block: bigint, pocketId: bigint): Promise<RpcLog[]>;
  /** All Earmark logs in an inclusive range (at most MAX_SPAN blocks). */
  logsInRange(fromBlock: bigint, toBlock: bigint): Promise<RpcLog[]>;
}

/** Arc's RPC refuses spans of 10,000 blocks or more; stay well under it. */
export const MAX_SPAN = 2_000n;
/** Beyond this gap the live poll gives up and the feed is rebuilt from the pointers instead. */
export const MAX_POLL_GAP = 6_000n;
export const PAGE_SIZE = 30;

export function pocketTopic(pocketId: bigint): Hex {
  return pad(numberToHex(pocketId), { size: 32 });
}

/** Decodes raw logs into feed events, keeping only Earmark events emitted by `address`. */
export function toFeedEvents(logs: readonly RpcLog[], address: Address): FeedEvent[] {
  const formatted = logs
    .filter((l) => l.address.toLowerCase() === address.toLowerCase())
    .map((l) => formatLog(l));
  const parsed = parseEventLogs({ abi: earmarkAbi, logs: formatted, strict: true });
  const out: FeedEvent[] = [];
  for (const ev of parsed) {
    const ts = (ev as { blockTimestamp?: bigint | null }).blockTimestamp;
    out.push({
      key: `${ev.transactionHash}:${ev.logIndex}`,
      event: ev,
      pocketId: ev.args.pocketId,
      blockNumber: ev.blockNumber,
      logIndex: ev.logIndex,
      txHash: ev.transactionHash,
      timestamp: typeof ts === 'bigint' ? ts : null,
    });
  }
  return out;
}

/** Newest first: block number, then log index (never timestamps, which Arc blocks can share). */
export function compareNewestFirst(a: FeedEvent, b: FeedEvent): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
  return b.logIndex - a.logIndex;
}

/** Merges event lists, removing duplicates by transaction and log index, newest first. */
export function mergeFeeds(...lists: readonly (readonly FeedEvent[])[]): FeedEvent[] {
  const seen = new Map<string, FeedEvent>();
  for (const list of lists) for (const ev of list) if (!seen.has(ev.key)) seen.set(ev.key, ev);
  return [...seen.values()].sort(compareNewestFirst);
}

function prevOf(ev: FeedEvent): bigint | null {
  const args = ev.event.args as { prevEventBlock?: bigint };
  return typeof args.prevEventBlock === 'bigint' ? args.prevEventBlock : null;
}

export interface WalkResult {
  events: FeedEvent[];
  /** The next block to read for older events, or null once the pocket's creation has been reached. */
  next: bigint | null;
}

/**
 * Walks one pocket's history backwards from `start` (its `lastEventBlock`, or a `next` from an earlier page) until
 * `limit` events are loaded or the creation block is reached. Each pointer block is known to hold at least one event
 * for the pocket, so an empty answer means a lagging RPC backend and is retried rather than taken as the end.
 */
export async function walkPocket(
  source: LogSource,
  address: Address,
  pocketId: bigint,
  start: bigint,
  limit: number = PAGE_SIZE,
  retryDelay = 400,
): Promise<WalkResult> {
  const events: FeedEvent[] = [];
  let block: bigint | null = start;
  while (block !== null && events.length < limit) {
    let found: FeedEvent[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      found = toFeedEvents(await source.logsInBlock(block, pocketId), address).filter((e) => e.pocketId === pocketId);
      if (found.length > 0) break;
      await sleep(retryDelay * (attempt + 1));
    }
    if (found.length === 0) throw new Error(`No Earmark events found in block ${block} for pocket ${pocketId}`);
    events.push(...found);

    if (found.some((e) => e.event.eventName === 'PocketCreated')) {
      block = null;
      break;
    }
    let next: bigint | null = null;
    for (const ev of found) {
      const prev = prevOf(ev);
      if (prev !== null && prev < block && (next === null || prev < next)) next = prev;
    }
    block = next;
  }
  return { events: mergeFeeds(events), next: block };
}

/**
 * Reads every Earmark log between two blocks, in windows of at most MAX_SPAN blocks. Returns null when the gap is too
 * large to poll (a tab that slept for a long time); the caller then rebuilds from the pointers.
 */
export async function pollRange(
  source: LogSource,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<FeedEvent[] | null> {
  if (toBlock < fromBlock) return [];
  if (toBlock - fromBlock > MAX_POLL_GAP) return null;
  const out: FeedEvent[] = [];
  for (let from = fromBlock; from <= toBlock; from += MAX_SPAN) {
    const to = from + MAX_SPAN - 1n < toBlock ? from + MAX_SPAN - 1n : toBlock;
    out.push(...toFeedEvents(await source.logsInRange(from, to), address));
  }
  return mergeFeeds(out);
}

/** A LogSource over any EIP-1193-style request function (viem's `client.request`). */
export function rpcLogSource(
  request: (args: { method: 'eth_getLogs'; params: [unknown] }) => Promise<unknown>,
  address: Address,
): LogSource {
  const get = async (filter: Record<string, unknown>) => (await request({ method: 'eth_getLogs', params: [filter] })) as RpcLog[];
  return {
    logsInBlock: (block, pocketId) =>
      get({ address, fromBlock: numberToHex(block), toBlock: numberToHex(block), topics: [null, pocketTopic(pocketId)] }),
    logsInRange: (from, to) => get({ address, fromBlock: numberToHex(from), toBlock: numberToHex(to) }),
  };
}
