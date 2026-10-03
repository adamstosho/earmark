import type { PocketHue } from '../ds/typed';

// D3: the contract stores `icon` (0 to 9) and `hue` (0 to 5); both map to the design system's pocket set in this order.

export const POCKET_ICONS = [
  'graduation-cap',
  'bowl-food',
  'house-line',
  'first-aid-kit',
  'lightning',
  'device-mobile',
  'bus',
  'shopping-bag',
  'hand-heart',
  'piggy-bank',
] as const;

export const POCKET_HUES = ['palm', 'sky', 'clay', 'teal', 'plum', 'olive'] as const satisfies readonly PocketHue[];

export type PocketIconName = (typeof POCKET_ICONS)[number];

/** Default hue per purpose (PocketIcon README): food palm, school fees sky, rent clay, emergency teal, gifts plum, transport olive. */
const DEFAULT_HUE: Partial<Record<PocketIconName, number>> = {
  'bowl-food': 0,
  'graduation-cap': 1,
  'house-line': 2,
  'first-aid-kit': 3,
  'hand-heart': 4,
  bus: 5,
};

export function iconName(index: number): PocketIconName {
  return POCKET_ICONS[index] ?? 'piggy-bank';
}

export function hueName(index: number): PocketHue {
  return POCKET_HUES[index] ?? 'palm';
}

export function defaultHueFor(iconIndex: number): number | undefined {
  return DEFAULT_HUE[iconName(iconIndex)];
}
