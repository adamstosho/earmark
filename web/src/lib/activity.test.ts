import {
  encodeAbiParameters,
  encodeEventTopics,
  numberToHex,
  pad,
  type AbiEvent,
  type Address,
  type Hex,
  type RpcLog,
} from 'viem';
import { describe, expect, it } from 'vitest';
import { earmarkAbi } from '../abi';
import { mergeFeeds, pollRange, pocketTopic, toFeedEvents, walkPocket, type LogSource } from './activity';

const ADDRESS: Address = '0x1111111111111111111111111111111111111111';
const SPONSOR: Address = '0x2222222222222222222222222222222222222222';
const SPENDER: Address = '0x3333333333333333333333333333333333333333';
const PAYEE: Address = '0x4444444444444444444444444444444444444444';

function eventAbi(name: string): AbiEvent {
  const found = earmarkAbi.find((e) => e.type === 'event' && e.name === name);
  if (!found || found.type !== 'event') throw new Error(`no event ${name}`);
  return found;
}

let txCounter = 0;

/** Builds an RPC log exactly as eth_getLogs returns it, encoded from the real ABI. */
function makeLog(name: string, args: Record<string, unknown>, block: number, logIndex: number, emitter = ADDRESS): RpcLog {
  const abiEvent = eventAbi(name);
  const topics = encodeEventTopics({ abi: [abiEvent], eventName: name, args });
  const dataInputs = abiEvent.inputs.filter((i) => !i.indexed);
  const data = encodeAbiParameters(
    dataInputs,
    dataInputs.map((i) => args[i.name ?? '']),
  );
  txCounter += 1;
  return {
    address: emitter,
    topics: topics as [Hex, ...Hex[]],
    data,
    blockHash: pad(numberToHex(block), { size: 32 }),
    blockNumber: numberToHex(block),
    logIndex: numberToHex(logIndex),
    transactionHash: pad(numberToHex(txCounter), { size: 32 }),
    transactionIndex: '0x0',
    removed: false,
  };
}

/** Pocket 1: created in block 100, two funds in block 105 (same block), a spend in block 110. */
function history(): RpcLog[] {
  return [
    makeLog('PocketCreated', {
      pocketId: 1n, sponsor: SPONSOR, spender: SPENDER, label: 'Food', limitPerPeriod: 20_000_000n,
      periodLength: 604_800n, lockUntil: 0n, payeeOnly: false, icon: 1, hue: 0,
    }, 100, 0),
    makeLog('PayeeSet', { pocketId: 1n, payee: PAYEE, allowed: true, prevEventBlock: 100n }, 100, 1),
    makeLog('Funded', { pocketId: 1n, from: SPONSOR, amount: 30_000_000n, prevEventBlock: 100n }, 100, 2),
    makeLog('Refuelled', { pocketId: 1n, spender: SPENDER, amount: 50_000n, prevEventBlock: 100n }, 100, 3),
    makeLog('Funded', { pocketId: 1n, from: SPONSOR, amount: 1_000_000n, prevEventBlock: 100n }, 105, 0),
    // Another pocket's event in the same block must never leak into pocket 1's feed.
    makeLog('Funded', { pocketId: 2n, from: SPONSOR, amount: 9_000_000n, prevEventBlock: 90n }, 105, 1),
    makeLog('Funded', { pocketId: 1n, from: SPONSOR, amount: 2_000_000n, prevEventBlock: 105n }, 105, 2),
    makeLog('Spent', { pocketId: 1n, to: PAYEE, amount: 8_000_000n, memo: 'rice', prevEventBlock: 105n }, 110, 0),
  ];
}

function fakeSource(logs: RpcLog[], opts: { emptyOnce?: number } = {}) {
  const calls: bigint[] = [];
  const ranges: [bigint, bigint][] = [];
  let emptied = false;
  const source: LogSource = {
    logsInBlock: (block, pocketId) => {
      calls.push(block);
      if (opts.emptyOnce !== undefined && Number(block) === opts.emptyOnce && !emptied) {
        emptied = true;
        return Promise.resolve([]);
      }
      return Promise.resolve(
        logs.filter((l) => BigInt(l.blockNumber ?? '0x0') === block && l.topics[1] === pocketTopic(pocketId)),
      );
    },
    logsInRange: (from, to) => {
      ranges.push([from, to]);
      return Promise.resolve(
        logs.filter((l) => {
          const b = BigInt(l.blockNumber ?? '0x0');
          return b >= from && b <= to;
        }),
      );
    },
  };
  return { source, calls, ranges };
}

describe('walkPocket', () => {
  it('rebuilds the full history by following prevEventBlock, one block at a time', async () => {
    const { source, calls } = fakeSource(history());
    const { events, next } = await walkPocket(source, ADDRESS, 1n, 110n, 30, 0);
    expect(calls).toEqual([110n, 105n, 100n]);
    expect(next).toBeNull();
    expect(events.map((e) => `${e.blockNumber}:${e.logIndex}:${e.event.eventName}`)).toEqual([
      '110:0:Spent',
      '105:2:Funded',
      '105:0:Funded',
      '100:3:Refuelled',
      '100:2:Funded',
      '100:1:PayeeSet',
      '100:0:PocketCreated',
    ]);
  });

  it('keeps both events when two land in the same block, and follows the lower pointer', async () => {
    const { source, calls } = fakeSource(history());
    const { events } = await walkPocket(source, ADDRESS, 1n, 105n, 30, 0);
    const inBlock105 = events.filter((e) => e.blockNumber === 105n);
    expect(inBlock105.map((e) => e.logIndex)).toEqual([2, 0]);
    expect(calls).toEqual([105n, 100n]);
  });

  it('stops at the creation block', async () => {
    const { source, calls } = fakeSource(history());
    const { next } = await walkPocket(source, ADDRESS, 1n, 100n, 30, 0);
    expect(next).toBeNull();
    expect(calls).toEqual([100n]);
  });

  it('pages with "Load older" and never duplicates', async () => {
    const { source } = fakeSource(history());
    const first = await walkPocket(source, ADDRESS, 1n, 110n, 2, 0);
    expect(first.events).toHaveLength(3); // the 110 spend and both 105 funds: whole blocks are never split
    expect(first.next).toBe(100n);
    const second = await walkPocket(source, ADDRESS, 1n, first.next ?? 0n, 2, 0);
    expect(second.next).toBeNull();
    const all = mergeFeeds(first.events, second.events, first.events);
    expect(all).toHaveLength(7);
    expect(new Set(all.map((e) => e.key)).size).toBe(7);
  });

  it('retries a pointer block that a lagging backend answers with no logs', async () => {
    const { source, calls } = fakeSource(history(), { emptyOnce: 105 });
    const { events, next } = await walkPocket(source, ADDRESS, 1n, 110n, 30, 0);
    expect(events).toHaveLength(7);
    expect(next).toBeNull();
    expect(calls).toEqual([110n, 105n, 105n, 100n]);
  });
});

describe('feed decoding and ordering', () => {
  it('reads only Earmark events from the Earmark address', () => {
    const logs = history();
    const stranger = makeLog('Funded', { pocketId: 1n, from: SPONSOR, amount: 1n, prevEventBlock: 1n }, 105, 5, SPONSOR);
    const events = toFeedEvents([...logs, stranger], ADDRESS);
    expect(events).toHaveLength(logs.length);
  });

  it('orders by block number, then log index, never by timestamp', () => {
    const events = toFeedEvents(history(), ADDRESS);
    const shuffled = [...events].reverse();
    const ordered = mergeFeeds(shuffled);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      expect(a.blockNumber > b.blockNumber || (a.blockNumber === b.blockNumber && a.logIndex > b.logIndex)).toBe(true);
    }
  });
});

describe('pollRange', () => {
  it('reads new blocks in windows of at most 2,000 blocks', async () => {
    const { source, ranges } = fakeSource(history());
    const events = await pollRange(source, ADDRESS, 100n, 4_600n);
    expect(ranges).toEqual([
      [100n, 2_099n],
      [2_100n, 4_099n],
      [4_100n, 4_600n],
    ]);
    expect(events).toHaveLength(8);
  });

  it('gives up on a gap too large to poll, so the feed is rebuilt from the pointers', async () => {
    const { source, ranges } = fakeSource(history());
    expect(await pollRange(source, ADDRESS, 0n, 9_000n)).toBeNull();
    expect(ranges).toHaveLength(0);
  });

  it('returns nothing when there is no new block', async () => {
    const { source } = fakeSource(history());
    expect(await pollRange(source, ADDRESS, 111n, 110n)).toEqual([]);
  });
});
