import { useSyncExternalStore } from 'react';
import { shortAddress } from '../ds/typed';
import { KEYS, readJson, writeItem } from './storage';

// Nicknames for addresses ("Mama"), kept only in this browser (D4). Never sent anywhere, never put on Arc.

export type NameBook = Readonly<Record<string, string>>;

const listeners = new Set<() => void>();
let cache: NameBook | null = null;

function load(): NameBook {
  if (cache) return cache;
  const raw = readJson(KEYS.names);
  const book: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (/^0x[0-9a-f]{40}$/.test(key) && typeof value === 'string' && value.trim() !== '') book[key] = value;
    }
  }
  cache = book;
  return book;
}

function save(book: NameBook): void {
  cache = book;
  writeItem(KEYS.names, JSON.stringify(book));
  listeners.forEach((fn) => fn());
}

export function getNames(): NameBook {
  return load();
}

export function setName(address: string, name: string): void {
  const key = address.toLowerCase();
  const trimmed = name.trim();
  const rest = Object.fromEntries(Object.entries(load()).filter(([k]) => k !== key));
  save(trimmed === '' ? rest : { ...rest, [key]: trimmed.slice(0, 40) });
}

export function removeName(address: string): void {
  setName(address, '');
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.names) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** The saved names, re-rendering when they change (also from another tab). */
export function useNames(): NameBook {
  return useSyncExternalStore(subscribe, load, load);
}

/** The saved name for an address, or its short form (0x3f2a…9c1e). */
export function displayName(book: NameBook, address: string | undefined): string {
  if (!address) return '';
  return book[address.toLowerCase()] ?? shortAddress(address);
}

export function savedName(book: NameBook, address: string | undefined): string | undefined {
  return address ? book[address.toLowerCase()] : undefined;
}
