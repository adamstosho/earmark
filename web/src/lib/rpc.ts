import { BaseError, HttpRequestError, TimeoutError } from 'viem';

/** Arc's public RPC is load balanced; a backend a block or two behind answers -32014 (FRICTION-LOG, 28 Sep). */
const RETRYABLE_CODES = new Set([-32014, -32005, -32603, 429]);

export function isRetryable(err: unknown): boolean {
  if (err instanceof BaseError) {
    const hit = err.walk((e) => {
      if (e instanceof HttpRequestError || e instanceof TimeoutError) return true;
      const code = (e as { code?: unknown }).code;
      return typeof code === 'number' && RETRYABLE_CODES.has(code);
    });
    if (hit) return true;
    return /requested data not available|header not found|unknown block/i.test(err.message);
  }
  return err instanceof TypeError;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn`, retrying transient RPC failures with backoff (300 ms, 600 ms, 1.2 s…). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5, baseDelay = 300): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryable(err) || i === attempts - 1) break;
      await sleep(baseDelay * 2 ** i);
    }
  }
  throw last;
}
