import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../config';
import { FALLBACK_GAS, feeCaps, GWEI, withHeadroom } from './gas';
import { endOfDayUnix, relativeTime, resetWhen } from './dates';
import { loadRate, parseRateResponse } from './rates';
import { byteLength, clampBytes, hasWideCharacters, parseAddress } from './text';

describe('fees (D6)', () => {
  it('uses twice the base fee plus 1 gwei, never below 25 gwei', () => {
    expect(feeCaps(20n * GWEI)).toEqual({ maxFeePerGas: 41n * GWEI, maxPriorityFeePerGas: GWEI });
    expect(feeCaps(5n * GWEI).maxFeePerGas).toBe(25n * GWEI);
    expect(feeCaps(100n * GWEI).maxFeePerGas).toBe(201n * GWEI);
  });

  it('adds 20% to estimates, rounding up (D7)', () => {
    expect(withHeadroom(100n)).toBe(120n);
    expect(withHeadroom(101n)).toBe(122n);
  });

  it('keeps every fallback at or above the PRD floors', () => {
    expect(FALLBACK_GAS.approve).toBeGreaterThanOrEqual(100_000n);
    expect(FALLBACK_GAS.fund).toBeGreaterThanOrEqual(150_000n);
    expect(FALLBACK_GAS.spend).toBeGreaterThanOrEqual(250_000n);
    expect(FALLBACK_GAS.request).toBeGreaterThanOrEqual(250_000n);
    expect(FALLBACK_GAS.approveRequest).toBeGreaterThanOrEqual(200_000n);
    expect(FALLBACK_GAS.createPocket).toBeGreaterThanOrEqual(600_000n);
  });
});

describe('text limits in bytes (C9)', () => {
  it('counts UTF-8 bytes, as the contract does', () => {
    expect(byteLength('Food')).toBe(4);
    expect(byteLength('Owó ilé-ìwé')).toBe(15);
    expect(hasWideCharacters('Owó ilé-ìwé')).toBe(true);
    expect(hasWideCharacters('Rent')).toBe(false);
  });

  it('cuts at a character boundary', () => {
    expect(clampBytes('ẹẹẹ', 7)).toBe('ẹẹ');
    expect(byteLength(clampBytes('Owó ilé-ìwé and more words here to cut', 32))).toBeLessThanOrEqual(32);
  });

  it('accepts only full addresses', () => {
    expect(parseAddress('0x3f2a9c1e5b7d4e8a9c217d4e5f6a8b90d1c29c1e')).toBe(
      getAddress('0x3f2a9c1e5b7d4e8a9c217d4e5f6a8b90d1c29c1e'),
    );
    expect(parseAddress('0x3f2a…9c1e')).toBeNull();
    expect(parseAddress('3f2a9c1e5b7d4e8a9c217d4e5f6a8b90d1c29c1e')).toBeNull();
  });
});

describe('dates', () => {
  const now = new Date(2026, 8, 29, 15, 0); // Tue 29 Sep 2026, 3:00 pm
  it('follows the content guide', () => {
    expect(relativeTime(new Date(2026, 8, 29, 14, 59, 30), now)).toBe('Just now');
    expect(relativeTime(new Date(2026, 8, 29, 14, 48), now)).toBe('12 min ago');
    expect(relativeTime(new Date(2026, 8, 29, 9, 5), now)).toBe('Today, 9:05 am');
    expect(relativeTime(new Date(2026, 8, 28, 21, 5), now)).toBe('Yesterday, 9:05 pm');
    expect(relativeTime(new Date(2026, 8, 26, 12, 0), now)).toBe('Sat 26 Sept');
    expect(relativeTime(new Date(2025, 11, 12, 12, 0), now)).toBe('12 Dec 2025');
  });

  it('words resets by period', () => {
    expect(resetWhen(new Date(2026, 9, 5, 10), 7, now)).toBe('Monday');
    expect(resetWhen(new Date(2026, 8, 29, 18, 30), 1, now)).toBe('at 6:30 pm');
    expect(resetWhen(new Date(2026, 9, 29, 10), 30, now)).toBe('29 Oct');
  });

  it('locks until the end of the chosen day', () => {
    const t = endOfDayUnix('2026-12-12');
    expect(t).not.toBeNull();
    const d = new Date(Number(t) * 1000);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 11, 12, 23]);
    expect(endOfDayUnix('12/12/2026')).toBeNull();
  });
});

describe('naira rate (US-10)', () => {
  it('reads a positive NGN rate with its update time', () => {
    const r = parseRateResponse({ result: 'success', rates: { NGN: 1327.3 }, time_last_update_unix: 1_790_000_000 }, 5);
    expect(r).toEqual({ rate: 1327.3, updatedAt: 1_790_000_000_000, fetchedAt: 5 });
  });

  it('never accepts a missing or zero rate', () => {
    expect(parseRateResponse({ result: 'success', rates: {} }, 0)).toBeNull();
    expect(parseRateResponse({ result: 'success', rates: { NGN: 0 } }, 0)).toBeNull();
    expect(parseRateResponse({ result: 'error' }, 0)).toBeNull();
  });

  it('hides naira when the rate service fails', async () => {
    const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    expect(await loadRate(failing, 0)).toBeNull();
    const notOk = (() => Promise.resolve(new Response('{}', { status: 503 }))) as typeof fetch;
    expect(await loadRate(notOk, 0)).toBeNull();
  });
});

describe('config', () => {
  it('lists every missing setting', () => {
    const result = readConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toHaveLength(4);
  });

  it('accepts a valid testnet setup', () => {
    const result = readConfig({
      VITE_NETWORK: 'arcTestnet',
      VITE_POCKETS_ADDRESS: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      VITE_DEPLOY_BLOCK: '64500000',
      VITE_RPC_URL: 'https://rpc.testnet.arc.io',
      VITE_DEMO_POCKET_ID: '',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.chain.id).toBe(5042002);
      expect(result.config.deployBlock).toBe(64_500_000n);
      expect(result.config.demoPocketId).toBeNull();
      expect(result.config.explorer).toBe('https://explorer.testnet.arc.io');
    }
  });

  it('rejects the zero address and plain http outside localhost', () => {
    const result = readConfig({
      VITE_NETWORK: 'arcMainnet',
      VITE_POCKETS_ADDRESS: '0x0000000000000000000000000000000000000000',
      VITE_DEPLOY_BLOCK: '1',
      VITE_RPC_URL: 'http://rpc.mainnet.arc.io',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toHaveLength(2);
  });
});
