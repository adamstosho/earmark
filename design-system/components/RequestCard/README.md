# RequestCard

A payment the family member asked for that is above the pocket's rules, waiting for the sender.

**Provide:** `pocketLabel`, `icon`, `hue`, `amount`, `rate`, `memo`, `to`, `time`, `state`, `onApprove`, `onDecline`.

- "Approve and pay" is tonal because requests repeat in a list; Decline is a quiet ghost button because nothing is lost, the money stays in the pocket.
- While a decision is being sent, set `state` to `approving` or `declining`: the chosen button shows progress and the other is disabled.
- The memo is quoted exactly as written. Do not translate or correct it.
- On phones, requests appear first on the dashboard because they need action.
