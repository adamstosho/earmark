# Implementation

How the Earmark web app (Vite, React, TypeScript, per the PRD) uses this system. Everything here is free: open fonts under the SIL Open Font License, Phosphor icons under MIT, no paid services.

## What to copy into the app

| From this system | Into the app | Notes |
| --- | --- | --- |
| `tokens.css` | `web/src/styles/tokens.css` | Generated from `tokens.json`; includes the `@font-face` rules. Update the font URLs to `/fonts/...`. |
| `fonts/*.woff2` and `licenses/` | `web/public/fonts/` | Keep the licence files with the fonts. |
| `components/bundle.css` | `web/src/styles/earmark.css` | Component and layout styles with the `ek-` prefix. |
| `components/src/index.tsx`, `icons.json`, `logo.ts` | `web/src/ds/` | Typed React source for every component. |
| Logos asset group | `web/public/icons/` | App icon and share images. |

Import order in `main.tsx`: `tokens.css`, then `earmark.css`, then your own styles.

The component source reads a global `React` so the published bundle can run without a build. In the app, replace its first lines with a normal import:

```tsx
import * as React from 'react';
import ICONS from './icons.json';
import { TAG_PATH, RING_PATH, WORDMARK_PATH, WORDMARK_SCALE, WORDMARK_WIDTH } from './logo';
```

Then import components directly: `import { PocketCard, Money, formatUSDC } from './ds';`.

## `index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
  <meta name="theme-color" content="#F9F6F2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0B0E18" media="(prefers-color-scheme: dark)">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/icons/earmark-mark.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
  <script>
    (function () {
      var saved = null;
      try { saved = localStorage.getItem('ek-theme'); } catch (e) {}
      var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    })();
  </script>
  <title>Earmark</title>
</head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

The inline script sets the theme before the first paint, so there is no flash. Store only the theme preference; the PRD rules out analytics and cookies.

## Theme switch

Offer System, Light and Dark in Settings with a `SegmentedControl`. On change, set `data-theme` on `html`, save the choice (or remove it for System), and update the `theme-color` meta to `#F9F6F2` or `#0B0E18`.

## Using tokens in your own CSS

Always reference the custom properties, never hex values:

```css
.rule-list { display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-md); background: var(--surface); color: var(--ink-muted); }
.rule-list strong { color: var(--ink); }
```

Breakpoints cannot be read from custom properties inside `@media`, so use the literal values: `600px`, `1024px`, `1440px`.

Use plain CSS with these tokens, as the PRD allows. If Tailwind is added later, map tokens under new names (for example `--color-brand: var(--brand)`) and never redefine `--font-sans`, which the tokens already own.

## Money and chain values

- Keep USDC amounts as `bigint` in 6-decimal base units from the contract to the UI edge. Convert to a number only for display, through `formatUnits(value, 6)` from viem, then `formatUSDC`.
- Never mix the 18-decimal native balance with the 6-decimal ERC-20 value (PRD requirement A1).
- Parse user input with `parseUnits(amount, 6)`; the `AmountInput` and `applyKey` helpers already limit input to two decimals.
- Fetch the naira rate once an hour and pass it as `rate`; when it fails, pass nothing and the naira lines disappear.

## Wiring transactions to `TxStatus`

```tsx
const [steps, setSteps] = React.useState([
  { label: 'Confirm in your wallet', state: 'active' },
  { label: 'Final', state: 'todo' },
]);
// after the wallet returns a hash:
setSteps([{ label: 'Confirm in your wallet', state: 'done' }, { label: 'Final', detail: 'Sending to Arc', state: 'active' }]);
// after the receipt:
setSteps([{ label: 'Confirm in your wallet', state: 'done' }, { label: 'Final', detail: 'This cannot be reversed.', state: 'done' }]);
```

Map contract errors to the messages in Content and voice with one lookup table (`lib/errors.ts` in the PRD).

## Review checklist for every screen

- [ ] Only tokens, type styles and `ek-` classes; no raw colours or ad hoc font sizes.
- [ ] One primary button; repeated actions use `tonal`.
- [ ] People's words (names, pocket labels, notes) in Inter, never in the display face.
- [ ] Amounts through `Money` or the format helpers, with tabular numerals.
- [ ] Checked at 360px and 1280px, in light and dark.
- [ ] Every on-chain action shows `TxStatus` through to Final, with a receipt link.
- [ ] No banned words from the word list.
