# ActivityItem

One movement of money or change of rule, in a feed ordered newest first. Wrap items in `ActivityList`.

**Provide:** `kind`, `title`, `detail` (usually the pocket name), `time`, `amount`, `status`, `href` to the receipt on the explorer.

| Kind | Title example | Amount |
| --- | --- | --- |
| `spent` | Paid 0x3f2a…9c1e | minus, ink |
| `funded` | Added by Ṣadé | plus, green |
| `requested` | Asked for textbooks | muted, with Pending |
| `approved` | Approved: rice and palm oil | minus, ink |
| `declined` | Declined: new phone | muted, with Declined |
| `fee` | Fee credit | minus, ink |
| `locked` | Locked until 12 Dec | none |

- Order by block number and log index, never by timestamp: Arc blocks can share a timestamp.
- Every on-chain item links to its receipt. Say "receipt", not "transaction hash".
- Titles wrap to two lines; do not truncate names.
