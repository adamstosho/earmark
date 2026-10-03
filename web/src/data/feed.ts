import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEnv } from '../app/env';
import { mergeFeeds, PAGE_SIZE, walkPocket, type FeedEvent } from '../lib/activity';
import { useLive } from './live';
import type { PocketView } from './pockets';

export interface Feed {
  events: FeedEvent[];
  loading: boolean;
  error: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  retry: () => void;
}

interface Walked {
  /** The request this result answers; the feed is loading while it differs from the current one. */
  key: string;
  events: FeedEvent[];
  cursors: Map<string, bigint | null>;
  error: boolean;
}

const EMPTY: Walked = { key: '', events: [], cursors: new Map(), error: false };

/**
 * The activity for a set of pockets: each pocket's history walked back from its `lastEventBlock`, merged with the
 * app's live events, newest first and without duplicates.
 */
export function useFeed(pockets: readonly PocketView[] | undefined, pageSize: number = PAGE_SIZE): Feed {
  const env = useEnv();
  const live = useLive();
  const [walked, setWalked] = useState<Walked>(EMPTY);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Walk again only when the set of pockets changes, after a long sleep, or on Try again; not on balance refreshes.
  const ids = useMemo(() => (pockets ?? []).map((p) => p.id), [pockets]);
  const idsKey = ids.map(String).join(',');
  const key = pockets === undefined ? '' : `${idsKey}|${live.epoch}|${attempt}`;
  const [starts, setStarts] = useState<readonly PocketView[]>([]);
  if (pockets !== undefined && starts.map((p) => p.id).join(',') !== idsKey) setStarts(pockets);

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    Promise.all(starts.map((p) => walkPocket(env.source, env.config.pockets, p.id, p.lastEventBlock, pageSize)))
      .then((results) => {
        if (cancelled) return;
        setWalked({
          key,
          events: mergeFeeds(...results.map((r) => r.events)),
          cursors: new Map(results.map((r, i) => [starts[i]?.id.toString() ?? '', r.next])),
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setWalked({ key, events: [], cursors: new Map(), error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, starts, env, pageSize]);

  const loadOlder = useCallback(() => {
    const pending = [...walked.cursors.entries()].filter((entry): entry is [string, bigint] => entry[1] !== null);
    if (pending.length === 0) return;
    setLoadingOlder(true);
    Promise.all(pending.map(([id, next]) => walkPocket(env.source, env.config.pockets, BigInt(id), next, pageSize)))
      .then((results) => {
        setWalked((prev) => {
          const cursors = new Map(prev.cursors);
          results.forEach((r, i) => cursors.set(pending[i]?.[0] ?? '', r.next));
          return { ...prev, events: mergeFeeds(prev.events, ...results.map((r) => r.events)), cursors };
        });
      })
      .catch(() => setWalked((prev) => ({ ...prev, error: true })))
      .finally(() => setLoadingOlder(false));
  }, [walked.cursors, env, pageSize]);

  const current = walked.key === key ? walked : null;
  const events = useMemo(() => {
    const wanted = new Set(ids.map(String));
    const fresh = live.events.filter((e) => wanted.has(e.pocketId.toString()));
    return mergeFeeds(fresh, current?.events ?? []);
  }, [ids, live.events, current]);

  return {
    events,
    loading: current === null,
    error: current?.error ?? false,
    hasOlder: current ? [...current.cursors.values()].some((c) => c !== null) : false,
    loadingOlder,
    loadOlder,
    retry: () => setAttempt((a) => a + 1),
  };
}
