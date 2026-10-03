import { useSyncExternalStore } from 'react';

// Short confirmations after an action ("Paid $12.50 from Food"). They live outside any screen, so a toast still
// appears when a sheet was closed while its payment was being sent (Sheet README).

export interface ToastItem {
  id: number;
  message: string;
  tone: 'neutral' | 'positive' | 'negative';
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function showToast(message: string, tone: ToastItem['tone'] = 'positive'): void {
  items = [...items.slice(-2), { id: nextId++, message, tone }];
  emit();
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}
