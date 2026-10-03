import { describe, expect, it } from 'vitest';
import { copy } from './copy';

// D1 and the content guide's word list: people never need to know Earmark runs on a blockchain.
const BANNED = /\b(gas|gwei|transactions?|tx|hash(es)?|mainnet|sponsors?|spenders?|blockchain|smart contract|protocol|on-chain|confirmed|mined|settled|blacklist(ed)?|deposit|OK|Submit)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Every string in copy.ts, calling templates with sample arguments. */
function collect(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') {
    out.push([path, value]);
  } else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    const args = Array.from({ length: fn.length }, (_, i) => (i === 0 ? 'Food' : '$12.50'));
    collect(fn(...args), path, out);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collect(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out);
  }
}

const strings: [string, string][] = [];
collect(copy, 'copy', strings);

describe('copy', () => {
  it('has strings to check', () => {
    expect(strings.length).toBeGreaterThan(200);
  });

  it('never uses a banned word', () => {
    const offenders = strings.filter(([, s]) => BANNED.test(s));
    expect(offenders).toEqual([]);
  });

  it('mentions testnet only in the proof-of-concept notice', () => {
    const offenders = strings.filter(([path, s]) => /testnet/i.test(s) && path !== 'copy.poc.testnet');
    expect(offenders).toEqual([]);
  });

  it('has no emoji and no exclamation marks', () => {
    expect(strings.filter(([, s]) => EMOJI.test(s) || s.includes('!'))).toEqual([]);
  });

  it('uses sentence case for buttons', () => {
    const buttons = [copy.dashboard.newPocket, copy.create.button, copy.pocket.addMoney, copy.pocket.takeBack];
    for (const b of buttons) expect(b.slice(1)).toBe(b.slice(1).toLowerCase());
  });
});
