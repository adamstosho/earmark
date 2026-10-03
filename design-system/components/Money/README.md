# Money

Formats and displays a USDC amount, with the indicative naira value underneath when a rate is given.

**Provide:** `value` (a number in USDC), `size`, optional `rate`, `direction` for feed rows, `align`.

- Sizes: `hero` for the balance on a pocket page and the amount being entered; `lg` on pocket and request cards; `md` in lists; `sm` inline.
- Money in (`direction="in"`) is green with a plus. Money out is `ink` with a true minus sign: spending is normal, not an error.
- All figures use tabular numerals, so balances do not jump as they update.
- Screen readers hear "12.50 dollars, about 18,750 naira" rather than symbols.
- Format rules: always two decimals for USDC; naira rounded to the whole naira with comma grouping; the unit "USDC" appears once per screen, beside the main balance.
