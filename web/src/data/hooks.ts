import { useQuery } from '@tanstack/react-query';
import { erc20Abi, type Address } from 'viem';
import { useEnv } from '../app/env';
import { USDC_ADDRESS } from '../chains';
import { loadRate } from '../lib/rates';
import { withRetry } from '../lib/rpc';
import {
  fetchPayees,
  fetchPendingRequests,
  fetchPocket,
  fetchPockets,
  fetchRequests,
  fetchRoles,
  type PocketView,
  type RequestView,
} from './pockets';

// Every read comes from the RPC (A8). Queries live under ['earmark', …] so the live poll can refresh them all.

const idsKey = (ids: readonly bigint[] | undefined) => (ids ?? []).map(String).join(',');

export function useRoles(account: Address | undefined) {
  const env = useEnv();
  return useQuery({
    queryKey: ['earmark', 'roles', account],
    queryFn: () => fetchRoles(env, account as Address),
    enabled: account !== undefined,
    refetchInterval: 15_000,
  });
}

export function usePockets(ids: readonly bigint[] | undefined) {
  const env = useEnv();
  return useQuery({
    queryKey: ['earmark', 'pockets', idsKey(ids)],
    queryFn: () => fetchPockets(env, ids ?? []),
    enabled: ids !== undefined,
    placeholderData: (prev) => prev,
  });
}

export function usePocket(id: bigint | undefined) {
  const env = useEnv();
  return useQuery({
    queryKey: ['earmark', 'pocket', id?.toString()],
    queryFn: () => fetchPocket(env, id ?? 0n),
    enabled: id !== undefined,
  });
}

export function usePayees(id: bigint | undefined) {
  const env = useEnv();
  return useQuery({
    queryKey: ['earmark', 'payees', id?.toString()],
    queryFn: () => fetchPayees(env, id ?? 0n),
    enabled: id !== undefined,
    staleTime: 60_000,
  });
}

/** Pending requests across pockets, newest first. */
export function usePendingRequests(pockets: readonly PocketView[] | undefined) {
  const env = useEnv();
  const withPending = (pockets ?? []).filter((p) => p.pending > 0n);
  return useQuery({
    queryKey: ['earmark', 'pending', withPending.map((p) => `${p.id}:${p.pending}:${p.lastEventBlock}`).join(',')],
    queryFn: async () => {
      const lists = await Promise.all(withPending.map((p) => fetchPendingRequests(env, p)));
      return lists.flat().sort((a, b) => (a.id > b.id ? -1 : 1));
    },
    enabled: pockets !== undefined,
    placeholderData: (prev) => prev,
  });
}

/** Request details for feed items (Approved and Declined events carry only the request id). */
export function useRequestDetails(ids: readonly bigint[]) {
  const env = useEnv();
  const unique = [...new Set(ids.map(String))].map(BigInt);
  return useQuery({
    queryKey: ['earmark', 'requests', idsKey(unique)],
    queryFn: async (): Promise<Map<string, RequestView>> => {
      const list = unique.length ? await fetchRequests(env, unique) : [];
      return new Map(list.map((r) => [r.id.toString(), r]));
    },
    enabled: unique.length > 0,
    placeholderData: (prev) => prev,
  });
}

/** A USDC balance through the 6-decimal ERC-20 interface, never the 18-decimal native one (A1, D13). */
export function useUsdcBalance(account: Address | undefined) {
  const env = useEnv();
  return useQuery({
    queryKey: ['earmark', 'usdc', account],
    queryFn: () =>
      withRetry(() =>
        env.client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account as Address] }),
      ),
    enabled: account !== undefined,
  });
}

export function useRate() {
  return useQuery({
    queryKey: ['rate'],
    queryFn: () => loadRate(),
    staleTime: 3_600_000,
    refetchInterval: 3_600_000,
    retry: false,
  });
}

/** Block times for feed rows whose logs arrived without `blockTimestamp`. */
export function useBlockTimes(blocks: readonly bigint[]) {
  const env = useEnv();
  const unique = [...new Set(blocks.map(String))];
  return useQuery({
    queryKey: ['blocktimes', unique.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        unique.map(async (b) => {
          const block = await withRetry(() => env.client.getBlock({ blockNumber: BigInt(b) }));
          return [b, block.timestamp] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: unique.length > 0,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
}
