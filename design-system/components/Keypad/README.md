# Keypad

A 3 by 4 on-screen number pad for entering amounts on phones.

**Provide:** `onKey`, and apply keys with the exported `applyKey(value, key)` helper, which keeps two decimals and nine characters.

- Place it at the bottom of the screen, in thumb reach, directly above the primary button.
- Use it only on compact screens. On medium and expanded screens hide it and let the `AmountInput` take keyboard input.
- Keys are 56px tall. The delete key is labelled "Delete last digit" for screen readers.
