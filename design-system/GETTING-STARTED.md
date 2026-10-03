# Getting started

Version 1.0 · 28 September 2026

This folder is the complete Earmark design system: the brand book, the tokens, the fonts, the logos and icons, the written guidelines, and 27 React components with a live preview of each. Everything works offline and everything in it is free to use.

## View it

Open `index.html` in Chrome, Edge, Safari or Firefox. The gallery shows every foundation, guideline, component and screen, with live previews. Use the theme button at the top right to switch between light and dark.

Each `components/<Name>/preview.html` also opens on its own and follows your device's light or dark setting.

If a browser refuses to show the previews from your disk (some company-managed browsers block local files), serve the folder instead: run `npx serve .` inside it and open the address it prints.

## What is inside

| Path | What it is |
| --- | --- |
| `index.html` | The offline gallery. Start here. |
| `README.md` | The brand book: principles, colour, typography, space and shape, motion, icons, logo, and the patterns borrowed from other apps. |
| `tokens.json` | The source of truth for every token: colour in both themes, type, spacing, radius, shadow, size, breakpoints, z-index and opacity, each with a usage note. |
| `tokens.css` | The same tokens as CSS custom properties, with the `@font-face` rules and one class per type style. |
| `fonts/` | Inter, Bricolage Grotesque and IBM Plex Mono as WOFF2 files. |
| `licenses/` | The SIL Open Font License for each font, and the MIT licences for Phosphor Icons and React. |
| `guidelines/` | Content and voice, layout and responsiveness, screen patterns, accessibility, and implementation. |
| `components/bundle.js` and `bundle.css` | A ready-to-run build: every component on `window.Earmark`, styled with the `ek-` class prefix. |
| `components/src/` | The typed React source (`index.tsx`, `icons.json`, `logo.ts`) to copy into the app. |
| `components/index.d.ts` | Type definitions for every component and helper. |
| `components/<Name>/` | A README and a live preview for each component and each sample screen. |
| `assets/Logos/` | Seven SVG logos, plus PNG app icons at 180, 192 and 512 pixels. |
| `assets/Icons/` | The 64 Phosphor icons the product uses, as SVG. |
| `gallery/` | Files the offline gallery needs (the React 18 runtime and embedded fonts). The app does not need them. |

## Use it in the Earmark app

These steps match the PRD's stack (Vite, React and TypeScript). `guidelines/50-implementation.md` gives the full detail.

1. Copy `tokens.css` to `web/src/styles/tokens.css`, then change the four font URLs from `fonts/` to `/fonts/`.
2. Copy the `.woff2` files and the `licenses` folder to `web/public/fonts/`.
3. Copy `components/bundle.css` to `web/src/styles/earmark.css`.
4. Copy `components/src/` to `web/src/ds/` and replace its first lines with normal imports, as the implementation guide shows.
5. In `main.tsx`, import `tokens.css`, then `earmark.css`, then your own styles.
6. Add the theme script from the implementation guide to `index.html`, so the right theme is set before the first paint.
7. Copy `assets/Logos/earmark-mark.svg` and the PNG app icons to `web/public/icons/` for the favicon and the web app manifest.

## Type style classes

For text outside a component, use the type style classes in `tokens.css` rather than setting sizes by hand:

```html
<h1 class="ek-type-heading-xl">Your pockets</h1>
<p class="ek-type-body-sm">Resets every Monday.</p>
<span class="ek-type-amount-lg">$240.00</span>
```

There is one class for each of the 19 styles, from `.ek-type-display-xl` to `.ek-type-mono-sm`. The four display styles and the two large amount styles use Bricolage Grotesque, which is subset to English, currency and number glyphs. Never use them for words people wrote, such as names, pocket labels or notes; use `heading-md` or a body style, which are set in Inter.

## Building with an AI coding tool

Add this folder to the project and ask the tool to read `README.md`, `guidelines/50-implementation.md` and `components/index.d.ts` before it writes any screen. The review checklist at the end of the implementation guide is a good final check for each screen.

## Licences

- Inter, Bricolage Grotesque and IBM Plex Mono: SIL Open Font License 1.1. Keep the licence files with the fonts.
- Phosphor Icons: MIT licence.
- React 18 (used only by the offline gallery): MIT licence.
