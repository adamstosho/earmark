# Sheet

A focused task over the current screen: a bottom sheet on phones and a centred dialog from 600px.

**Provide:** `open`, `onClose`, `title`, optional `description`, the body, and `footer` with the secondary action first and the primary last.

- Titles are set in Inter because they usually contain a pocket name ("Pay from Owó ilé-ìwé").
- Built on the native `dialog` element, so focus is trapped, Escape closes it and the page behind is inert.
- On phones the footer stacks with the primary action on top and full width; from 600px it sits on the right.
- Use sheets for Pay, Ask, Add money, Approve and rule changes. Use a full screen instead when the task needs the keypad on a phone (see the Pay screen).
- Closing a sheet with a transaction in progress does not cancel the transaction. Keep the `TxStatus` visible or show a toast when it finishes.
