# AppShell

The responsive frame for every signed-in screen: tab bar on phones, rail on tablets, side navigation on laptops and desktops.

**Provide:** `nav` items, an optional `navFooter`, and the page as children.

Inside, use the layout classes from `bundle.css`:

| Class | Does |
| --- | --- |
| `.ek-page` | Centred content up to `size-content-max` with the right gutters and safe-area padding for each size. |
| `.ek-page__head`, `__eyebrow`, `__title`, `__lede` | Page title block; actions sit on its right. Add `is-people` to the title when it is a pocket or person's name. |
| `.ek-section`, `__head`, `__title` | A titled group within a page. |
| `.ek-grid` | Card grid: as many 280px-minimum columns as fit. |
| `.ek-split` | Main column plus a 336px side column from 1024px. |
| `.ek-split__lead` | The side column's content that comes first on phones (requests). |
| `.ek-panel` | A bordered container for lists. |
| `.ek-stack` | Vertical stack with a 16px gap. |

- A skip link to the content appears on keyboard focus.
