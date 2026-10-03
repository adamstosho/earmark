import { useSyncExternalStore } from 'react';

// Hash routes (D9), so the app runs on any static host with no rewrites.

export type Route =
  | { name: 'landing' }
  | { name: 'send' }
  | { name: 'requests' }
  | { name: 'activity' }
  | { name: 'new' }
  | { name: 'pocket'; id: bigint }
  | { name: 'family' }
  | { name: 'familyActivity' }
  | { name: 'pay'; id: bigint; mode: 'pay' | 'ask' }
  | { name: 'view'; id: bigint }
  | { name: 'settings' }
  | { name: 'notFound' };

const ID = /^[1-9]\d{0,18}$/;

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (parts.length === 0) return { name: 'landing' };
  if (parts.length === 1) {
    switch (a) {
      case 'send':
        return { name: 'send' };
      case 'requests':
        return { name: 'requests' };
      case 'activity':
        return { name: 'activity' };
      case 'new':
        return { name: 'new' };
      case 'family':
        return { name: 'family' };
      case 'settings':
        return { name: 'settings' };
      default:
        return { name: 'notFound' };
    }
  }
  if (parts.length === 2 && a === 'p' && b && ID.test(b)) return { name: 'pocket', id: BigInt(b) };
  if (parts.length === 2 && a === 'view' && b && ID.test(b)) return { name: 'view', id: BigInt(b) };
  if (parts.length === 2 && a === 'family' && b === 'activity') return { name: 'familyActivity' };
  if (parts.length === 3 && a === 'family' && (b === 'pay' || b === 'ask') && c && ID.test(c)) {
    return { name: 'pay', id: BigInt(c), mode: b };
  }
  return { name: 'notFound' };
}

export const paths = {
  landing: '#/',
  send: '#/send',
  requests: '#/requests',
  activity: '#/activity',
  newPocket: '#/new',
  pocket: (id: bigint) => `#/p/${id}`,
  family: '#/family',
  familyActivity: '#/family/activity',
  pay: (id: bigint) => `#/family/pay/${id}`,
  ask: (id: bigint) => `#/family/ask/${id}`,
  view: (id: bigint) => `#/view/${id}`,
  settings: '#/settings',
};

export function navigate(hash: string): void {
  if (window.location.hash !== hash) window.location.hash = hash;
}

/** Full links to share: the family link and the public pocket page (D11). */
export function absoluteLink(hash: string): string {
  return `${window.location.origin}/${hash}`;
}

function subscribe(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseRoute(hash);
}
