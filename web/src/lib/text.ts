import { getAddress, isAddress, type Address } from 'viem';

const encoder = new TextEncoder();

/** UTF-8 length. The contract limits labels (32) and notes (64) in bytes, and letters with marks take 2 to 3 bytes. */
export function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/** True when the text has characters that take more than one byte, so the hint can explain a shorter limit. */
export function hasWideCharacters(text: string): boolean {
  return byteLength(text) > text.length;
}

/** Cuts text to at most `max` UTF-8 bytes without splitting a character. */
export function clampBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text;
  let out = '';
  for (const ch of text) {
    if (byteLength(out + ch) > max) break;
    out += ch;
  }
  return out;
}

/** A full 0x address typed or pasted by a person, checksummed; null otherwise. Accepts any letter case. */
export function parseAddress(input: string): Address | null {
  const text = input.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(text)) return null;
  if (!isAddress(text, { strict: false })) return null;
  return getAddress(text);
}

export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
}
