# TabBar

Bottom navigation on phones, with three to five destinations.

**Provide:** `items`, each with `icon`, `label`, `href` or `onClick`, `active`, and an optional `badge` count.

- Sender: Pockets, Requests, Activity, Settings. Family: Home, Activity, Settings.
- The active item uses the filled icon on an indigo pill and brand text. Counts are announced ("2 waiting").
- It pads for the bottom safe area and hides from 600px, where `SideNav` takes over.
- Hide it on focused task screens such as Pay.
