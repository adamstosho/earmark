// The only browser storage Earmark uses (DECISIONS C22): the theme, nicknames (D4), the last naira rate with its
// time, and the chosen view for a wallet with both roles. Nothing here ever leaves the device.

export const KEYS = {
  theme: 'ek-theme',
  names: 'ek-names',
  rate: 'ek-rate',
  view: 'ek-view',
} as const;

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode or site data off): the app still works, it just forgets the preference.
  }
}

export function readJson(key: string): unknown {
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
