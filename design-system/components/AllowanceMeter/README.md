# AllowanceMeter

Shows what is left of a pocket's allowance this period, as numbers first and a bar second.

**Provide:** `spent`, `limit`, `hue`, `periodLabel` (for example "this week"), `resetLabel` (for example "Resets Monday").

- At 80% used it adds "Almost used"; at 100% it says "Limit reached. Ask for approval." Both are shown in words, never by colour alone.
- A `limit` of 0 means every payment is a request; the component says so instead of drawing an empty bar.
- The numbers are the source of truth. The bar gives the glance.
