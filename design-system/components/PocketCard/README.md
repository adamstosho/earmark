# PocketCard

The core object of Earmark: one labelled pocket with its balance, its allowance and the next action.

**Provide:** `label`, `icon`, `hue`, `balance`, `rate`, `limit`, `spent`, `resetLabel`, `view` (`sender` or `family`), and handlers: `onAddMoney` and `onOpen` or `href` for senders; `onPay` and `onAsk` for family.

| View | Shows | Actions |
| --- | --- | --- |
| `sender` | Balance, allowance, Locked badge, pending requests count | Add money (tonal), open (chevron) |
| `family` | Balance, allowance | Pay (tonal) and Ask; a request-only pocket shows one "Ask for a payment" button |

- The lock badge appears only in the sender view: a lock limits the sender, not the family, and would confuse a spender.
- Lay cards out with `.ek-grid`: one column on phones, two from 600px, three on wide screens. Card actions stay pinned to the bottom so a row lines up.
- The pocket name is written by people in any language and is always set in Inter.
