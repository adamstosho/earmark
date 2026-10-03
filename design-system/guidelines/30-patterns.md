# Screen patterns

Each screen in the product, built only from this system's components and layout classes. The four Screens previews show them live at 390px and 1280px.

## Landing (`/#/`)

- Compact: logo, `display-lg` headline "Money sent home, with a purpose.", one `body-lg` sentence, the primary "Connect wallet" button (`lg`, full width), then "See a live pocket" as a ghost link. Below: three numbered steps (Fund a pocket, Set the rules, Watch it spent) and the proof-of-concept `Notice`.
- Expanded: headline in `display-xl` on the left, a real `PocketCard` (family view, read-only) on the right as the illustration. No stock photos, no illustrations of people.

## Sender dashboard (`/#/send`)

- Page head: eyebrow "Across 4 pockets", title "Your pockets", lede with the total in USDC and naira. Actions: "Share family link" (secondary) and "New pocket" (primary, the only one).
- `.ek-split`: pockets in `.ek-grid` in the main column; "Waiting for you" (`RequestCard` list) and a short `ActivityList` in the side column, marked `.ek-split__lead` so requests come first on phones.
- Empty: `EmptyState` "No pockets yet" with "Create a pocket".
- Loading: three skeleton pocket cards and one skeleton request.

## New pocket (`/#/new`)

A task screen on phones, a sheet from 600px. Fields in this order, one decision each:

1. Pocket name (`TextField`) with the pocket icon and hue picker beneath (`PocketIcon` row, radio group).
2. Who can spend: the family member's address or a saved name.
3. Allowance: `SegmentedControl` for the period, then the limit (`TextField` with `$` prefix). "Every payment is a request" is a `Switch` that sets the limit to 0.
4. Rules: `Switch` "Approved payees only" (reveals the payee list) and `Switch` "Lock until a date" (reveals a date field, at most two years ahead).
5. Fee credit: pre-set to $0.05 with a one-line explanation; editable under "More options".
6. First deposit: `AmountInput`.
7. Summary card, then the primary "Create pocket".

After the tap, replace the form with `TxStatus`: "Allow Earmark to move 250 USDC", "Create the pocket", "Ready to share". On Final, show the family link with copy and share actions.

## Pocket page, sender (`/#/p/:id`)

- `AppBar` with the pocket name on phones; page head on larger screens, with `is-people` on the title because the name was written by the sender.
- Top block: `PocketIcon` (`lg`), `Money` `hero`, then `AllowanceMeter`, then the rules as a short list with icons (period and limit, approved payees, lock date, fee credit).
- Actions: "Add money" (primary), "Take money back" (secondary, disabled with the lock date shown while locked), "Share" (icon button).
- Sections: Waiting for you (requests for this pocket), Approved payees (with Remove, `danger` in a confirmation sheet), Activity.

## Family home (`/#/family`)

- Greeting eyebrow, "Your pockets" title and a lede naming the sender. The latest top-up appears as a positive `Notice` for 24 hours.
- One `PocketCard` in family view per pocket, stacked; Pay (tonal) and Ask on each. Request-only pockets show one "Ask for a payment" button.
- A single `caption` line explains fees: "Network fees come out of your pockets. You never need to buy anything else."
- Empty: "Nothing here yet. Ṣadé will add money soon." with no action.

## Pay and Ask

- Phones: full task screen. `AppBar` "Pay from Food", `AmountInput` (read-only) at the top, the payee row, `Keypad` at the bottom, then the primary button "Pay $12.50" (`lg`, full width). If the amount goes over the allowance, the input says so and the button becomes "Ask for approval".
- 600px and up: the same content in a `Sheet`, amount typed directly.
- Payee: pick from approved payees (radio list with names), or paste an address when the pocket allows any payee.
- Note: optional, 64 characters, with the hint "Notes are public on Arc".
- After the tap: `TxStatus` in place of the keypad, ending in Final with a receipt link and a toast "Paid $12.50 from Food".

## Public pocket (`/#/view/:id`)

Read-only, no wallet: pocket header, balance, allowance and rules, then the full activity with receipts. A slim banner at the top: "You are viewing a pocket. Connect a wallet to act on it." This is the page reviewers and relatives open from a shared link.

## Transaction lifecycle

Every on-chain action follows the same four states and never skips one on screen:

| State | Shown as | Copy |
| --- | --- | --- |
| Waiting for wallet | `Button` loading, `TxStatus` step active | "Confirm in your wallet" |
| Submitted | `TxStatus` step active | "Sending to Arc" |
| Final | `TxStatus` step done, receipt link, toast | "Final" (payments add "This cannot be reversed.") |
| Failed | `TxStatus` step error, `Notice` negative | What happened and what to do (see Content and voice) |

Arc finality is deterministic, so treat the first receipt as Final. Do not show confirmation counters.

## Confirming irreversible actions

- Payments need no extra "Are you sure?" step: the amount and payee are on screen, the button names the amount, and the wallet asks once more.
- "Take money back" of the whole balance and "Remove payee" open a short confirmation `Sheet` that restates the effect in one sentence, with the action repeated on the button.

## System states

- **Wrong network:** a caution `Notice` at the top of the page with "Switch to Arc" as its action.
- **Arc unreachable:** keep the last loaded data visible, mark it "Last updated 2:14 pm", and show a negative `Notice` with "Try again".
- **No naira rate:** hide the naira lines; never show zero.
- **Proof of concept:** the info `Notice` "Use small amounts while Earmark is being tested" stays on the sender dashboard until launch.
