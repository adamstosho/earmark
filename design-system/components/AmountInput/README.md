# AmountInput

The large amount entry at the top of Pay, Ask and Add money, with the naira equivalent and what is available underneath.

**Provide:** `value` as a string, `onChange`, `rate` (naira per USDC, display only), `available` when there is a limit, `label`. Set `readOnly` when a `Keypad` drives it.

- On compact screens pair it with `Keypad` and set `readOnly`, so the system keyboard does not cover the screen. From 600px, let people type into it directly.
- The naira figure is always labelled "indicative" and only appears once an amount is entered. Never let it look like a quote.
- When the amount is more than is available, the component says so and suggests asking for approval. Keep the primary button's label in step: "Pay $12.50" or "Enter an amount".
