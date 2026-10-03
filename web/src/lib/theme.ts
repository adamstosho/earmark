import { KEYS, readItem, writeItem } from './storage';

// Theme switch from the implementation guide: System, Light or Dark. Only the preference is stored.

export type ThemePref = 'system' | 'light' | 'dark';

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
}

export function setThemePref(pref: ThemePref): void {
  writeItem(KEYS.theme, pref === 'system' ? null : pref);
  applyTheme(pref);
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
