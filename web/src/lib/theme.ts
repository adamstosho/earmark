import { KEYS, readItem, writeItem } from './storage';

// Theme switch from the implementation guide: System, Light or Dark. Only the preference is stored.

export type ThemePref = 'system' | 'light' | 'dark';

const listeners = new Set<() => void>();

const LIGHT = '#F9F6F2';
const DARK = '#0B0E18';

export function themePref(): ThemePref {
  const saved = readItem(KEYS.theme);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePref): void {
  const dark = pref === 'system' ? systemDark() : pref === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta) => {
    if (pref === 'system') meta.content = meta.media.includes('dark') ? DARK : LIGHT;
    else meta.content = dark ? DARK : LIGHT;
  });
  listeners.forEach((fn) => fn());
}

export function setThemePref(pref: ThemePref): void {
  writeItem(KEYS.theme, pref === 'system' ? null : pref);
  applyTheme(pref);
}

/** Lets the floating switch and Settings stay in step. */
export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** Flips between Light and Dark. Where the browser supports it, the new theme spreads out from the press point. */
export function toggleTheme(origin?: { x: number; y: number }): void {
  const next: ThemePref = isDark() ? 'light' : 'dark';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Older Safari and Firefox have no View Transitions; the theme then changes at once.
  const supported = 'startViewTransition' in document;
  if (!supported || reduce) {
    setThemePref(next);
    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.style.setProperty('--ek-reveal-x', `${x}px`);
  root.style.setProperty('--ek-reveal-y', `${y}px`);
  root.style.setProperty('--ek-reveal-r', `${radius}px`);
  root.setAttribute('data-theme-switching', '');
  const transition = document.startViewTransition(() => setThemePref(next));
  void transition.finished.finally(() => root.removeAttribute('data-theme-switching'));
}

/** Follows the device when the preference is System. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (themePref() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
