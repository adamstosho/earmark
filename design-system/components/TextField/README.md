# TextField

A labelled single-line or multi-line input with hint and error text.

**Provide:** `label` (always visible, never replaced by the placeholder), `value` and `onChange`, optional `hint`, `error`, `prefix`, `suffix`, `mono` for addresses, `multiline` for notes. Pass input attributes such as `inputMode`, `autoComplete` and `enterKeyHint` straight through.

- Text is 16px so iOS never zooms the page.
- Put the hint under the field, and replace nothing: an error appears above the hint, starts with an icon and says how to fix the problem.
- Use `mono` for addresses so characters can be compared one by one. Use `inputMode="decimal"` for amounts that are not on the keypad.
- Validate on blur or on submit, not on every keystroke.
- Labels and values accept any language. Pocket names such as "Owó ilé-ìwé", "Ego ụlọ akwụkwọ" or "Kuɗin makaranta" render correctly because the field uses Inter.
