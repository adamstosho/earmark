# Layout and responsiveness

Earmark is one responsive web app that behaves like a native app on phones and like a calm dashboard on laptops. Design at 360px first, then let the layout open up; never hide content at larger sizes or remove it at smaller ones.

## Window sizes

The compact limit matches the 600px compact window-size class that Android and Material Design use, so phone layouts behave like native apps; the larger breakpoints follow common tablet and laptop widths.

| Size | Width | Navigation | Content layout | Gutter | Sheets | Amount entry |
| --- | --- | --- | --- | --- | --- | --- |
| Compact | below `bp-medium` (under 600px) | `TabBar` at the bottom | One column; requests before pockets | `space-4` (16px) | Bottom sheet | `Keypad` |
| Medium | `bp-medium` (600px) to 1023px | 88px rail (`size-rail`) | Two-column card grid | `space-6` (24px) | Centred dialog, 560px max | Typed |
| Expanded | `bp-expanded` (1024px) to 1439px | 256px side navigation (`size-sidenav`) | Main column plus 336px side column | `space-8` (32px) | Centred dialog | Typed |
| Wide | `bp-wide` (1440px) and up | 256px side navigation | Same, content capped at `size-content-max` (1120px) and centred | `space-10` (40px) | Centred dialog | Typed |

`AppShell`, `.ek-page`, `.ek-grid` and `.ek-split` apply all of this; screens only compose them. Test at 360, 390 and 412px (common Android and iPhone widths), 768, 1024, 1280 and 1440px.

## The phone app

- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`. Never disable zoom.
- **Safe areas:** `AppBar`, `TabBar`, `Sheet` and `.ek-page` pad for `env(safe-area-inset-*)`, so the app is safe edge to edge on notched phones and when installed.
- **Heights:** use `dvh` units (`100dvh`), not `vh`, so the layout follows the mobile browser's toolbars.
- **Touch:** every target is at least `size-tap-min` (44px) with 8px between neighbours. The primary action of a task sits at the bottom, full width, `size-control-lg` (52px).
- **Keyboards:** amounts use the on-screen `Keypad` on phones. Other fields set `inputmode`, `enterkeyhint` and `autocomplete` so the right keyboard appears, and addresses set `autocomplete="off"`, `autocapitalize="off"` and `spellcheck="false"`.
- **Task screens** (Pay, Ask, Add money, Create pocket) hide the tab bar and show only a back button, so there is one way out.
- **Landscape phones** keep the compact layout; sheets scroll within `92dvh`.

## Installable app (PWA)

Ship a web app manifest so family members can add Earmark to their home screen and open it like any app:

```json
{
  "name": "Earmark",
  "short_name": "Earmark",
  "start_url": "/#/",
  "display": "standalone",
  "background_color": "#F9F6F2",
  "theme_color": "#F9F6F2",
  "icons": [
    { "src": "/icons/earmark-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/earmark-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/earmark-app-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

Export the PNG icons from `earmark-app-icon.svg` (Logos asset group); its tag sits inside the 80% safe zone for maskable icons. Set the browser bar colour per theme:

```html
<meta name="theme-color" content="#F9F6F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0E18" media="(prefers-color-scheme: dark)">
```

## Grids and alignment

- Cards sit in `.ek-grid`: as many columns as fit at a 280px minimum, 16px gaps on phones and 20px from 600px. Card actions are pinned to the bottom so a row of cards lines up.
- Forms and reading text never exceed `size-reading-max` (680px), even on wide screens.
- Align numbers to the right in lists and to the left on cards; never centre a column of amounts except the single amount being entered.

## Performance on real networks

- Total font payload is about 267 KB: preload Inter (145 KB) only; Bricolage Grotesque (88 KB) and IBM Plex Mono load on first use with `font-display: swap`.
- Keep the JavaScript bundle under 300 KB gzipped. No images in the interface; the logo and icons are inline SVG.
- Render skeletons for anything read from Arc, and never block the whole screen on the naira rate.
