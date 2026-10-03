# Accessibility

Earmark targets WCAG 2.2 level AA on every screen, in both themes. Many family members will use older phones in bright light, with larger system text, or with a screen reader, so accessibility is part of the core product, not an extra.

## Contrast

Every text pair below was measured from the tokens (WCAG 2 relative luminance). Text needs 4.5:1; control boundaries, focus rings and meaningful icons need 3:1.

| Foreground | Background | Light | Dark | Minimum |
| --- | --- | --- | --- | --- |
| `ink` | `canvas` | 15.9:1 | 16.9:1 | 4.5:1 |
| `ink` | `surface` | 17.1:1 | 15.8:1 | 4.5:1 |
| `ink-muted` | `canvas` | 6.8:1 | 10.3:1 | 4.5:1 |
| `ink-muted` | `surface-sunken` | 6.2:1 | 10.7:1 | 4.5:1 |
| `ink-subtle` | `canvas` | 5.1:1 | 7.3:1 | 4.5:1 |
| `ink-subtle` | `surface-sunken` | 4.7:1 | 7.6:1 | 4.5:1 |
| `on-brand` | `brand` | 12.1:1 | 9.6:1 | 4.5:1 |
| `brand-text` | `surface` | 9.3:1 | 9.6:1 | 4.5:1 |
| `brand-text` | `brand-soft` | 7.8:1 | 8.1:1 | 4.5:1 |
| `accent-text` | `accent-soft` | 6.0:1 | 8.4:1 | 4.5:1 |
| `on-accent` | `accent` | 5.5:1 | 9.9:1 | 4.5:1 |
| `positive` | `positive-soft` | 5.9:1 | 8.9:1 | 4.5:1 |
| `caution` | `caution-soft` | 6.3:1 | 8.8:1 | 4.5:1 |
| `negative` | `negative-soft` | 6.7:1 | 8.6:1 | 4.5:1 |
| `on-negative` | `negative-solid` | 5.7:1 | 9.8:1 | 4.5:1 |
| `ink-inverse` | `surface-inverse` | 18.0:1 | 15.8:1 | 4.5:1 |
| `line-strong` | `surface` | 3.8:1 | 3.9:1 | 3:1 |
| `line-strong` | `canvas` | 3.5:1 | 4.1:1 | 3:1 |
| `line-strong` | `surface-sunken` | 3.2:1 | 4.3:1 | 3:1 |
| `focus-ring` | `surface` | 4.4:1 | 6.4:1 | 3:1 |
| `focus-ring` | `canvas` | 4.1:1 | 6.8:1 | 3:1 |
| `focus-ring` | `surface-raised` | 4.4:1 | 5.8:1 | 3:1 |
| `pocket-palm-ink` | `pocket-palm-tint` | 7.0:1 | 8.8:1 | 4.5:1 |
| `pocket-sky-ink` | `pocket-sky-tint` | 6.9:1 | 8.9:1 | 4.5:1 |
| `pocket-clay-ink` | `pocket-clay-tint` | 7.2:1 | 8.8:1 | 4.5:1 |
| `pocket-teal-ink` | `pocket-teal-tint` | 6.8:1 | 9.0:1 | 4.5:1 |
| `pocket-plum-ink` | `pocket-plum-tint` | 7.2:1 | 8.8:1 | 4.5:1 |
| `pocket-olive-ink` | `pocket-olive-tint` | 6.8:1 | 9.0:1 | 4.5:1 |

Any new pairing must be checked the same way before it ships. Disabled controls (`opacity-disabled`) are exempt under WCAG but must still explain why they are disabled.

## Colour is never the only signal

- Status always has a word, and usually an icon: Final, Pending, Declined, Locked.
- Money in carries a plus sign as well as green; money out carries a minus sign.
- The allowance meter states the amount left in text; the bar only supports it.
- Locks use neutral cotton with a lock icon, so they are never confused with errors (crimson) or warnings (ochre).

## Keyboard and focus

- Everything works with a keyboard in a logical order. `AppShell` provides a "Skip to content" link.
- Focus shows as a solid 2px `focus-ring`, 2px outside the control, only for keyboard focus (`:focus-visible`).
- `SegmentedControl` moves with arrow keys; `Sheet` traps focus, closes on Escape and returns focus to the control that opened it (native `dialog`).

## Screen readers

- Amounts are announced as words: `Money` reads "12.50 dollars, about 18,750 naira" instead of symbols.
- `TxStatus` and `Toast` are polite live regions; a failed payment `Notice` is an alert.
- Icon-only buttons always carry a `label`. Navigation counts are read as "2 waiting".
- Addresses are shortened on screen, but copy and the tooltip use the full value.
- Test with TalkBack on Android Chrome (the main family device) and VoiceOver on iOS Safari.

## Text size and zoom

- Never disable pinch zoom. Layouts reflow at 200% browser zoom and at the largest Android font scale without horizontal scrolling at 320 CSS pixels.
- No fixed heights on anything that contains text; cards grow.
- Body text is 16px and the smallest text (`caption`) is 12px.

## Motion and sensory settings

- `prefers-reduced-motion`: transitions become instant, skeletons stop pulsing, spinners slow but keep turning.
- `forced-colors` (Windows high contrast): components add system-colour borders so buttons, badges and cards keep their edges.

## Plain language and cognitive load

- One task per screen on phones; one primary action per view.
- Confirm results with the amount and the pocket name ("Paid $12.50 from Food").
- Avoid time pressure: no timeouts on forms, and toasts pause while hovered or focused.

## Release checklist

- [ ] Lighthouse accessibility score of 90 or more on landing, dashboard, family home and pay.
- [ ] Every screen checked in both themes at 360px and 1280px.
- [ ] Keyboard-only walkthrough of create, fund, pay, request, approve and take back.
- [ ] TalkBack walkthrough of family home and pay.
- [ ] 200% zoom and largest system font on one Android phone.
