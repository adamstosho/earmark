import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEnv } from '../app/env';
import { mergeFeeds, pollRange, type FeedEvent } from '../lib/activity';
import { withRetry } from '../lib/rpc';

// One live poll for the whole app (PRD Section 8, step 5): every 2 seconds it reads Earmark's new events from the last
// block it saw to the latest, then refreshes every Earmark query so balances, allowances and requests follow within
// about a second. Feeds merge these events with their own pointer walks.

interface LiveState {
  events: FeedEvent[];
  /** Bumped when the poll fell too far behind; feeds then rebuild from the pointers. */
  epoch: number;
  /** Time of the last successful poll, for "Last updated". */
  lastOk: number | null;
  failing: boolean;
}

let state: LiveState = { events: [], epoch: 0, lastOk: null, failing: false };
const listeners = new Set<() => void>();

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLive(): LiveState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

const POLL_MS = 2_000;
/** While the RPC refuses calls (rate limit), wait longer between polls instead of adding to the load. */
const MAX_BACKOFF_MS = 12_000;
/** Start a little behind the head, so events between the first reads and the first poll are not missed. */
const LOOKBACK = 120n;

export function useLivePoller(): void {
  const env = useEnv();
  const queryClient = useQueryClient();

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let lastSeen: bigint | null = null;
    let delay = POLL_MS;
    let timer: number | undefined;

    const schedule = () => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      if (busy || stopped) return;
      if (document.visibilityState === 'hidden') return schedule();
      busy = true;
      try {
        const latest = await withRetry(() => env.client.getBlockNumber({ cacheTime: 0 }), 2);
        if (lastSeen === null) lastSeen = latest > LOOKBACK ? latest - LOOKBACK : 0n;
        if (latest > lastSeen) {
          const found = await pollRange(env.source, env.config.pockets, lastSeen + 1n, latest);
          if (found === null) {
            set({ epoch: state.epoch + 1, events: [] });
            void queryClient.invalidateQueries({ queryKey: ['earmark'] });
          } else if (found.length > 0) {
            set({ events: mergeFeeds(found, state.events).slice(0, 500) });
            void queryClient.invalidateQueries({ queryKey: ['earmark'] });
          }
          lastSeen = latest;
        }
        delay = POLL_MS;
        set({ lastOk: Date.now(), failing: false });
      } catch {
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
        if (!state.failing) set({ failing: true });
      } finally {
        busy = false;
        schedule();
      }
    };

    void tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        delay = POLL_MS;
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [env, queryClient]);
}
