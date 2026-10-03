import { useSyncExternalStore } from 'react';

// Compact windows are below 600px (bp-medium): task screens and the keypad there, sheets and typed amounts above.
const QUERY = '(max-width: 599.98px)';

function subscribe(fn: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}

export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

/** A phone or tablet, for the "open in your wallet app" hint (D12). */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

const EXPANDED = '(min-width: 1024px)';

function subscribeExpanded(fn: () => void) {
  const mq = window.matchMedia(EXPANDED);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}

/** 1024px and up (bp-expanded): the landing hero uses display-xl and shows a live pocket card. */
export function useIsExpanded(): boolean {
  return useSyncExternalStore(
    subscribeExpanded,
    () => window.matchMedia(EXPANDED).matches,
    () => false,
  );
}
