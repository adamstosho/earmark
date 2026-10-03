# Testnet rehearsal (PRD Section 11.3)

Nothing goes to mainnet until every step below passes on Arc testnet, first on a laptop, then again on a phone in a wallet's in-app browser.

## Before you start

- **Wallets:** three fresh accounts, each with Arc testnet added (the app adds it in one tap too).
  - **Sender:** needs about 100 testnet USDC from [faucet.circle.com](https://faucet.circle.com) (choose Arc Testnet).
  - **Family:** must hold **0 USDC** at the start. Step 3 checks that the pocket gives it its fee credit.
  - **Co-funder:** a few testnet USDC.
- **Contract:** deployed with `docs/DEPLOY.md`, and `web/.env.local` pointing at it.
- **App:** running with `cd web && npm run dev`. Open `http://localhost:5173` on the laptop. For the phone pass, use the Vercel preview URL (step 15).
- **Wallet display:** wallets may show testnet USDC as "ETH" or with 18 decimals. Earmark's own figures are the correct ones (PRD A11).

Write down each receipt link (the "View receipt" link on every Final step). They go in `deployments/arc-testnet.json` and help the friction log.

## Steps

| # | Do this | Pass when | Laptop | Phone |
| --- | --- | --- | --- | --- |
| 1 | Sender: put the wallet on any other network, open Earmark, Connect wallet, tap **Switch to Arc** on the notice | The wallet switches (or adds Arc) in one tap and the notice disappears | [ ] | [ ] |
| 2 | Sender: **New pocket**. Name "Food", Family's address, name "Mama", Week, weekly limit 20, fee credit left at $0.05, add 30 | Steps read "Allow Earmark to move 30.00 USDC", "Create the pocket", "Ready to share", each ending Final, then the family link | [ ] | [ ] |
| 3 | Check the Family wallet's USDC | It went from 0 to about 0.05 (shown in Earmark as "Fee credit: $0.05" on the family home) | [ ] | [ ] |
| 4 | Sender: **New pocket**. "School fees", turn on "Every payment is a request", "Approved payees only" with one payee, "Lock until a date" 7 days ahead, add 50 | Created; its card shows "Locked until …" and "Approved payees only" | [ ] | [ ] |
| 5 | Co-funder: open the public link for Food (`/#/view/1`), Connect, **Add money** 5 | A warning explains the creator can take the money back; after Final, the sender's Food feed shows "Added by 0x…" | [ ] | [ ] |
| 6 | Family: open the family link, **Pay** 8 from Food to any address, with a note | Final within about a second; the sender's open pocket page shows "Paid …" within 3 seconds, with no reload | [ ] | [ ] |
| 7 | Family: **Pay** 15 from Food | The amount says "More than is available", and the button reads **Ask for approval** | [ ] | [ ] |
| 8 | Family: tap **Ask for approval**. Sender: **Requests**, **Approve and pay** | The recipient receives 15; Food's "Available this week" is unchanged by the approval | [ ] | [ ] |
| 9 | Family: **Ask for a payment** from School fees. Sender: **Decline** | School fees' balance is unchanged; the feed shows "Declined" | [ ] | [ ] |
| 10 | Sender: open School fees | **Take money back** is disabled, with "You can take money back from {date}." underneath; **Move lock date** offers only later dates | [ ] | [ ] |
| 11 | Sender: Food, **Take money back** 5 | Final; the balance drops by 5; the feed shows "You took money back" | [ ] | [ ] |
| 12 | Open `/#/view/1` and `/#/view/2` in a private window with no wallet | Both open read-only with balance, rules and feed | [ ] | [ ] |
| 13 | Read the Food feed from the bottom up | Every step appears once, oldest at the bottom, each with a receipt link that opens on explorer.testnet.arc.io. After spends, "Fee credit added" rows appear whenever the family wallet dipped below $0.025 | [ ] | [ ] |
| 14 | Check naira figures, then block `open.er-api.com` (browser devtools, Network, block request URL) and reload | Naira shows with "indicative" and the rate's time; once blocked, every naira figure disappears and nothing else breaks | [ ] | [ ] |
| 15 | Repeat 1 to 14 on a phone, inside the MetaMask, OKX or Bitget in-app browser, using the Vercel preview URL | Same results; the Pay screen shows the keypad; no sideways scrolling | — | [ ] |

## What the local run already covered

`web/e2e/rehearsal.mjs` runs steps 1 to 14 against a local chain configured like Arc testnet (chain ID 5042002, 20 gwei base fee, a 6-decimal USDC at `0x3600…0000`). All 16 checks pass there, with no browser console errors, and a spend reaches the sender's screen under a second after Final.

What only Arc can confirm:

- Network fees paid in USDC, and so the fee-credit top-ups after spending.
- The real USDC contract.
- The load-balanced RPC.
- Real wallets.

## If something fails

Note the step, the device, the wallet, the exact message on screen and the receipt link, and send them over. Arc-specific snags go into `docs/FRICTION-LOG.md`.
