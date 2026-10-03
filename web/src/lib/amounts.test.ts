import { describe, expect, it } from 'vitest';
import { naira, parseUsdc, toDisplay, toInput, usd } from './amounts';

describe('parseUsdc', () => {
  it('parses whole amounts and up to two decimals into 6-decimal base units', () => {
    expect(parseUsdc('12')).toBe(12_000_000n);
    expect(parseUsdc('12.5')).toBe(12_500_000n);
    expect(parseUsdc('12.50')).toBe(12_500_000n);
    expect(parseUsdc('0.01')).toBe(10_000n);
    expect(parseUsdc('0.05')).toBe(50_000n);
    expect(parseUsdc(' 7 ')).toBe(7_000_000n);
    expect(parseUsdc('12.')).toBe(12_000_000n);
  });

  it('has no floating-point rounding errors', () => {
    const a = parseUsdc('0.1');
    const b = parseUsdc('0.2');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect((a ?? 0n) + (b ?? 0n)).toBe(parseUsdc('0.3'));
    expect(parseUsdc('1.13')).toBe(1_130_000n); // 1.13 * 1e6 is 1129999.9999999998 in floating point
    expect(parseUsdc('999999999999.99')).toBe(999_999_999_999_990_000n);
  });

  it('rejects empty, malformed, negative and over-precise input', () => {
    for (const bad of ['', ' ', '.', 'abc', '1,000', '-1', '12.345', '1e3', '0x10', '12..5']) {
      expect(parseUsdc(bad), bad).toBeNull();
    }
  });
});

describe('display edge', () => {
  it('converts base units to numbers only for display', () => {
    expect(toDisplay(123_456_789n)).toBe(123.456789);
    expect(toDisplay(0n)).toBe(0);
  });

  it('formats through the design system helpers', () => {
    expect(usd(1_240_500_000n)).toBe('$1,240.50');
    expect(usd(12_500_000n, 'out')).toBe('−$12.50');
    expect(usd(40_000_000n, 'in')).toBe('+$40.00');
    expect(usd(50_000n)).toBe('$0.05');
  });

  it('writes amounts back into inputs, rounding down so they never exceed the value', () => {
    expect(toInput(12_000_000n)).toBe('12');
    expect(toInput(12_345_678n)).toBe('12.34');
    expect(toInput(9_950_000n)).toBe('9.95');
    expect(toInput(5_000n)).toBe('0');
  });

  it('shows naira only with a positive rate', () => {
    expect(naira(10_000_000n, 1500)).toBe('₦15,000');
    expect(naira(12_500_000n, 1327.3)).toBe('₦16,591');
    expect(naira(10_000_000n, undefined)).toBeNull();
    expect(naira(10_000_000n, 0)).toBeNull();
  });
});
