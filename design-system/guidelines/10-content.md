# Content and voice

Earmark speaks like a trusted relative who is good with money: warm, direct and precise. Short sentences, everyday words, and the reader's own names for things.

## Voice

- Call the reader "you". Call other people by the name the sender gave them ("Mama", "Tolu"), never "the spender" or "the sponsor".
- Lead with what matters to the reader, then the detail: "You can spend $28.00 more this week", not "Your weekly limit of $40.00 has $28.00 remaining".
- Celebrate quietly. "Paid" and "Added" are enough; no exclamation marks, no emoji.
- Never blame. Say what happened and what to do next.
- Keep one idea per sentence and aim for 15 words or fewer.

## Word list

Earmark runs on a blockchain; people should never need to know that to use it.

| Do not say | Say | Notes |
| --- | --- | --- |
| gas, gas fee | network fee | |
| gas float, gas top-up | fee credit | "Fee credit added" in the activity feed |
| transaction, tx | payment, or the action itself | "Payment sent", "Pocket created" |
| transaction hash, tx hash | receipt | "View receipt" links to the explorer |
| confirmed, mined, settled | Final | "Final. This cannot be reversed." |
| smart contract, protocol | (leave out) | |
| wallet address, public key | address, or the saved name | Show the name wherever one exists |
| approve (the token allowance) | Allow Earmark to move 250 USDC | Only in the create and add-money steps |
| deposit, fund | Add money | |
| withdraw | Take money back | "Withdraw" is acceptable in sender settings |
| request (for family) | Ask, Ask for approval | Senders see "Requests" |
| sponsor, spender | you, or the person's name | |
| blocklisted | blocked by USDC compliance rules | |
| mainnet, testnet, chain | (leave out) | The proof-of-concept banner is the only exception |
| USD | USDC, or $ | Name USDC once per screen, beside the main balance |

## Money

- USDC: dollar sign, comma grouping, always two decimals: **$1,240.50**.
- Money in: **+$40.00** in `positive`. Money out: **−$12.50** with a true minus sign (U+2212) in `ink`.
- Naira: **≈ ₦18,750**, rounded to the whole naira, with the word "indicative" wherever the amount is being decided (entry, approval). Hide it if no rate is available; never show a stale rate without its time.
- Put amounts in action labels: "Pay $12.50", "Approve and pay $45.00" where space allows.
- Use `formatUSDC`, `formatNaira` and `shortAddress` from the bundle; never format money by hand.

## Dates and times

- Today and yesterday by name: "Today, 2:14 pm", "Yesterday, 9:05 am".
- Within the last hour: "12 min ago". Within the last week: "Mon 29 Sep". Older: "12 Dec 2025".
- Lock dates in full on the pocket page ("Locked until 12 Dec 2026") and short on badges ("Locked until 12 Dec").
- Resets by day name: "Resets Monday". 12-hour clock with lowercase am and pm.

## Buttons and labels

- Sentence case, verb first, as specific as possible: "Create pocket", "Add money", "Pay $12.50", "Ask for approval", "Approve and pay", "Decline".
- Never "OK", "Submit" or "Yes". The label says what will happen.
- Form labels are nouns ("Pocket name", "Weekly limit", "Pay to"). Hints explain consequences ("Your family sees this name").

## Errors

Write every error as what happened, then what to do.

| Situation | Message |
| --- | --- |
| Over the allowance | Only $28.00 is available this week. Ask for approval instead. |
| Not an approved payee | This pocket only pays approved people. Ask for approval instead. |
| Locked | This pocket is locked until 12 Dec 2026. |
| Pocket balance too low | The pocket only holds $6.00. |
| Bad address | This is not a full Arc address. It should start with 0x and have 42 characters. |
| Wrong network | Your wallet is on another network. Switch to Arc to continue. |
| Arc unreachable | Could not reach Arc. Check your connection and try again. |
| Blocked by compliance | USDC compliance rules stopped this payment. The network fee was still charged. |
| Wallet rejected | You cancelled in your wallet. Nothing was sent. |

## Names and languages

- Accept any script and any diacritics in pocket names, payee names and notes. Never auto-capitalise, trim tone marks or "correct" spelling.
- Show people's words exactly as they wrote them, in Inter, inside curly quotes when quoting a note.
- Product copy is British English for the MVP, kept in one file so Yoruba, Hausa and Igbo translations can follow.
