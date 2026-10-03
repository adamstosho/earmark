# Badge

One or two words of status or a rule, on a tinted pill.

**Provide:** `tone`, the text, and optionally `icon` (each tone has a default icon; `false` removes it).

| Tone | Means | Default icon |
| --- | --- | --- |
| `positive` | Final, received | check-circle |
| `caution` | Pending, waiting for someone | clock |
| `negative` | Declined, failed, blocked | x-circle |
| `accent` | Locked until a date | lock-simple |
| `neutral` | A rule: Approved payees only | none |
| `brand` | New, highlighted | none |

- A badge never relies on colour alone: the word always carries the meaning.
- Keep badges to one line. If a status needs explaining, use a `Notice`.
