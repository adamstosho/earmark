Earmark lets people abroad fund labelled USDC pockets on Arc (school fees, food, rent, emergency) that family members spend under rules the sender sets. This system serves two very different people at once: a sender who is used to banking apps, and a family member in Nigeria who may be new to both crypto and small screens. Every rule below comes back to that pair.

The look comes from **adire**, the Yoruba indigo resist-dyed cotton: indigo on unbleached cotton, with **camwood** (osun), the Yoruba red-brown dye, kept for one meaning only. It is a quiet, local reference that no other fintech uses, and it keeps the interface calm where money is concerned.

## Principles

1. **Money reads first.** Balances and amounts are the largest thing on any screen, in tabular numerals, with the naira equivalent under them.
2. **Plain words, no chain talk.** Say "network fee", "receipt" and "Final", never "gas", "transaction hash" or "confirmed on-chain" (the word list is in Content and voice).
3. **One primary action per view.** Indigo `brand` fills one button. Repeated actions in lists are `tonal`.
4. **Final means final.** Show every state honestly, from the wallet prompt to Final, and say plainly that payments cannot be reversed.
5. **Calm by default.** Colour signals only change of state. Spending is not an error, so money out is `ink`, not red.
6. **Built for a mid-range Android on patchy data.** 360px wide, 16px text, 44px targets, no decorative images, fonts subset to what is needed.

## Colour

Use the semantic tokens, never raw hex. Both themes are defined for every token, and every text pair named in a token's usage note meets WCAG AA (4.5:1) in both.

| Role | Tokens | Rule |
| --- | --- | --- |
| Grounds | `canvas`, `surface`, `surface-raised`, `surface-sunken` | `canvas` for the page, `surface` for cards and bars, `surface-raised` for sheets and menus, `surface-sunken` for wells and tracks. |
| Text | `ink`, `ink-muted`, `ink-subtle` | Three levels only. `ink-subtle` is for timestamps and placeholders, never for anything a person must read to act. |
| Lines | `line`, `line-strong` | `line` for dividers. `line-strong` for every control boundary (inputs, switches, secondary buttons), which keeps them at 3:1. |
| Brand (adire indigo) | `brand`, `brand-hover`, `on-brand`, `brand-text`, `brand-soft`, `brand-soft-hover` | One filled `brand` control per view. `brand-text` for links and active navigation. `brand-soft` for selection and info. |
| Accent (camwood) | `accent`, `on-accent`, `accent-text`, `accent-soft` | Only for commitment locks and the eyelet in the logo. Never for errors, never for primary actions. |
| Status | `positive`, `caution`, `negative` with `-soft` fills; `negative-solid`, `on-negative` | Always paired with a word and usually an icon. Green is money in and Final; ochre is pending or nearly used; crimson is failure. |
| Pockets | `pocket-<hue>`, `pocket-<hue>-tint`, `pocket-<hue>-ink` for palm, sky, clay, teal, plum, olive | Identify pockets only: the icon disc (tint and ink) and the allowance meter fill (the solid). Never as status colours. |
| Focus | `focus-ring` | A solid 2px ring, 2px outside the control, at least 3:1 on every ground in both themes. |

- On a `brand` fill use `on-brand`, which is white in light and deep indigo in dark. Never hard-code white.
- The dark theme is indigo night (`canvas` #0B0E18), not grey. Surfaces step up in lightness (`surface`, then `surface-raised`) instead of relying on shadows.
- Follow the device setting by default and offer a manual switch in Settings (see Implementation).

## Typography

Three families, each with a job. The pairing was chosen after testing 65 open-source families for the naira sign and every letter of Yoruba, Igbo and Hausa: only Inter and Noto Sans (with its mono cut) carry them all.

| Family | Token | Used for | Why |
| --- | --- | --- | --- |
| Bricolage Grotesque | `--font-display` | Page titles, section titles, sheet titles, large amounts, keypad digits | Designed by Mathieu Triay and added to Google Fonts in June 2023. Its designer describes it as trying "to express visually what it feels like to move countries and rebuild", which is exactly who sends money through Earmark. Variable weight, width and optical size, with ink traps at small sizes. It carries ₦, ẹ, ọ and the combining tone marks, but not ṣ or the Hausa hooked letters. |
| Inter | `--font-sans` | All interface text, labels, body copy and everything people type | Complete coverage of ₦, Yoruba (ẹ ọ ṣ with tone marks), Igbo (ị ụ ṅ) and Hausa (ɓ ɗ ƙ ƴ), tabular figures, and excellent rendering on Android. |
| IBM Plex Mono | `--font-mono` | Addresses and receipt numbers only | Distinguishes 0 from O and 1 from l when people compare characters. |

- **Never set text that people wrote in the display face.** Pocket names, sender names and memos are always Inter: "Ṣadé", "Owó ilé-ìwé", "Kuɗin makaranta" and "Ego ụlọ akwụkwọ" all render correctly there. The shipped Bricolage file only carries English, currency and number glyphs, so a title that contains someone's words (a pocket page titled with its name) adds `is-people` to `.ek-page__title` or `.ek-section__title`, and sheet titles are always Inter.
- Use the type styles, not ad hoc sizes: `display-xl` and `display-lg` on the landing page, `heading-xl` for page titles on phones, `heading-lg` for sections and sheets, `heading-md` for pocket names, `body` (16px) as the default, `body-sm` for secondary lines, `label` for buttons and form labels, `caption` (12px) as the floor.
- Amounts use `amount-hero`, `amount-lg`, `amount-md`, `amount-sm` and always tabular numerals (`.ek-num`).
- `overline` is uppercase English product copy only. Never uppercase Yoruba or anything people typed: capitals lose the tone marks' clarity.
- Sentence case everywhere, including buttons and titles.

## Space, shape and depth

- **Spacing** is a 4px scale: `space-1` (4) to `space-20` (80). Phone gutters are `space-4`; card padding is `space-4` on phones and `space-5` from 600px; sections are `space-8` apart.
- **Radius** comes from the tied circles of adire oniko: buttons, badges, tabs and meters are full pills (`radius-full`); cards are `radius-lg` (20px); inputs and notices `radius-md` (14px); sheets and dialogs `radius-xl` (28px).
- **Elevation** is light: `shadow-sm` on cards at rest, `shadow-md` on hover and floating bars, `shadow-lg` on sheets and toasts. Cards also carry a 1px `line` border so they hold their edge in bright sunlight.
- Do not use gradients, glass effects or coloured side borders on cards.

## Motion

Motion confirms, it never decorates. Durations and easing are CSS custom properties in `bundle.css`: `--ek-dur-fast` (120ms) for hover and press, `--ek-dur` (200ms) for toggles, `--ek-dur-slow` (320ms) for sheets and meter fills, all on `--ek-ease` (cubic-bezier(0.2, 0, 0, 1)). With reduced motion on, transitions become instant, skeletons stop pulsing and spinners slow down but keep turning, because they carry meaning.

## Iconography

- **Phosphor Icons**, Regular weight, 20px inside controls and rows, 24px in navigation, 16px in badges. The Fill weight marks the active tab and nothing else. The bundle carries the 64 icons the product needs; the full set is at phosphoricons.com under the MIT licence.
- Every pocket has an icon from the pocket set: graduation-cap, bowl-food, house-line, first-aid-kit, lightning, device-mobile, bus, shopping-bag, hand-heart, piggy-bank.
- No emoji in the interface.

## Logo

The mark is a label tag with a camwood eyelet: money with a label on it. Use `Logo` in code, or the SVG files in the Logos asset group elsewhere. Keep clear space equal to the eyelet's diameter, never go below 24px for the mark, and write the name as "Earmark" in running text (the wordmark alone is lowercase).

## Patterns borrowed, and from whom

Earmark takes proven patterns, not looks, from products its users already trust:

- **Named pots** from Monzo, which lets people "split your savings into different Pots for different goals". Earmark's pocket is the same mental model, spent by someone else.
- **Commitment locks** from PiggyVest's Safelock, which Nigerian savers know as funds set aside "without having access to it until maturity". The lock copy uses the same idea in plain words.
- **Staged status** from Wise, which moves a transfer through named statuses until it is sent. `TxStatus` does the same for wallet, sending and Final.
- **Keypad amount entry** from phone-first payment apps, so the amount is typed where the thumb already is.

Visual identity (indigo on cotton, the tag mark, Bricolage headings) is Earmark's own.

## Using this system

Tokens compile to CSS custom properties (`tokens.css`) with a light and a dark theme selected by `data-theme` on `html`. Components are React 18 function components on `window.Earmark`, styled by `components/bundle.css` with the `ek-` prefix. Read Layout and responsiveness before building screens, and Implementation before wiring the app.
