# Switch

An on or off rule that takes effect as soon as it is set, with a label and a description in plain words.

**Provide:** `label`, `description`, `checked`, `onChange`.

- Use for pocket rules: "Approved payees only", "Lock until a date". The description says what happens to the family member, not how it works on-chain.
- When turning a switch on starts a transaction, show the `TxStatus` straight after and keep the switch in its old state until the change is Final.
- Do not use a switch inside a form that is saved with a button; use a checkbox pattern there.
