# Toast

A short confirmation after an action. Show it for about five seconds at the bottom of the screen, and pause the timer while it is hovered or focused.

**Provide:** the message, optional `tone`, `action` and `onClose`. Place toasts inside a `.ek-toasts` container, which sits above the tab bar on phones.

- Use for results people expect: "Paid $12.50 from Food", "Address copied".
- Never use a toast for errors that need a decision; use a `Notice` or keep the sheet open with the error inside it.
- Keep it to one line and at most one action.
