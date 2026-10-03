# Button

Pill-shaped actions with a verb-first label. Primary (indigo) appears at most once per view, for the task the view exists for.

**Provide:** `variant`, `size`, the label as children, optional `iconStart` or `iconEnd`, `loading` while a transaction is in progress.

| Variant | Use for |
| --- | --- |
| `primary` | The one main task of the view: Pay, Create pocket, Approve in a sheet. |
| `tonal` | Positive actions that repeat down a list: Add money on each pocket, Approve and pay on each request. |
| `secondary` | The alternative to a primary: Cancel, Share family link. |
| `ghost` | Low-emphasis actions and navigation: Decline, Ask, See all. |
| `danger` | Actions that remove something: Remove payee. Declining a request is not destructive, so it uses `ghost`. |

- Sizes: `lg` (52px) for the primary action at the bottom of a phone screen or sheet; `md` (44px) everywhere else; `sm` (36px) only inside dense cards on expanded screens.
- Labels: sentence case, verb first, no full stop. Put the amount in payment labels: "Pay $12.50".
- `loading` keeps the label, swaps the icon for a spinner and blocks double taps. Use it from the wallet prompt until the transaction is Final.
- Prefer leaving a button enabled and explaining the problem on tap. When you do disable it, say why nearby, for example "Limit reached. Ask for approval."
