# Address

A wallet address shortened to its first six and last four characters, with copy and explorer actions.

**Provide:** `value` (the full address), optional `label`, `copy`, and `href` to the explorer page.

- The full address stays available in the tooltip and is copied whole.
- Announce copies to screen readers ("Address copied") and show a toast on screens where people will paste elsewhere.
- Never show an address where a pocket name or a payee's saved name exists. Addresses are a fallback for people who have not been named yet.
