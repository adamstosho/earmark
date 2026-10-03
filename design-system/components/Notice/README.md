# Notice

An inline message that stays on the page until the situation changes.

**Provide:** `tone`, `title`, the body as children, and an optional `action`.

| Tone | Use for |
| --- | --- |
| `info` | Context: "Proof of concept. Use small amounts." |
| `positive` | Something good just happened that changes what people can do: "Ṣadé added $40.00 to Food". |
| `caution` | Needs attention soon: "Almost used". |
| `negative` | Something failed and needs action: "Payment blocked". It is announced as an alert. |
| `lock` | Explains a commitment lock, in calm neutral cotton so it never looks like an error. |

- Title first, in a few words; the body says what it means for the reader and what to do next.
- One notice per concern. Stack at most two on a screen.
