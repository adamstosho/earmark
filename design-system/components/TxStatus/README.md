# TxStatus

Honest, step by step progress for anything that goes on-chain, from the wallet prompt to Final.

**Provide:** `title`, `steps` (each with `label`, optional `detail`, and `state`: `todo`, `active`, `done`, `error`), `href` to the receipt once Final.

- Standard labels: "Confirm in your wallet", "Sending to Arc", "Final". Creating a pocket has two wallet steps: allowing Earmark to move the deposit, then creating the pocket.
- Arc finality is deterministic: once a step says Final it cannot change. Say "Final" and add "This cannot be reversed" for payments.
- The region is a polite live region, so screen readers hear each change once.
