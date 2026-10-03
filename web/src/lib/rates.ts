import { KEYS, readJson, writeItem } from './storage';

// Indicative naira per USDC (US-10). Display only: never used in any calculation that moves money.
// The endpoint is free, needs no key, and asks for the attribution link shown next to naira figures.

export const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const MAX_AGE_MS = 3_600_000;

export interface NairaRate {
  /** Naira per USDC. */
  rate: number;
  /** When the provider last updated the rate: the time shown to people. */
  updatedAt: number;
  /** When this browser fetched it: drives the one-hour cache. */
  fetchedAt: number;
}

function isRate(value: unknown): value is NairaRate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.rate === 'number' &&
    v.rate > 0 &&
    Number.isFinite(v.rate) &&
    typeof v.updatedAt === 'number' &&
    typeof v.fetchedAt === 'number'
  );
}

/** Reads the provider's response. Returns null unless it holds a positive NGN rate. */
export function parseRateResponse(body: unknown, now: number): NairaRate | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { result?: unknown; rates?: { NGN?: unknown }; time_last_update_unix?: unknown };
  if (b.result !== 'success') return null;
  const rate = b.rates?.NGN;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  const updated = typeof b.time_last_update_unix === 'number' ? b.time_last_update_unix * 1000 : now;
  return { rate, updatedAt: updated, fetchedAt: now };
}

export function cachedRate(now: number = Date.now()): NairaRate | null {
  const value = readJson(KEYS.rate);
  if (!isRate(value)) return null;
  return now - value.fetchedAt < MAX_AGE_MS ? value : null;
}

/**
 * The rate from the one-hour cache, or a fresh fetch. When the fetch fails and the cache is older than an hour, it
 * returns null, and every naira figure disappears rather than showing a stale or zero value.
 */
export async function loadRate(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<NairaRate | null> {
  const cached = cachedRate(now);
  if (cached) return cached;
  try {
    const res = await fetchImpl(RATE_URL, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = parseRateResponse(await res.json(), now);
    if (parsed) writeItem(KEYS.rate, JSON.stringify(parsed));
    return parsed;
  } catch {
    return null;
  }
}
