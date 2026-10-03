# Decisions

Precedence: the product owner's decisions (D1 to D13), then `docs/PRD.md` for behaviour, then `design-system/` for everything the user sees. Every conflict found, and how it was resolved, is logged here. Entries marked **Open** wait for the product owner.

## Product owner decisions (28 Sep 2026)

| ID | Decision |
| --- | --- |
| D1 | User-facing text never says "gas", "transaction", "hash", "mainnet", "sponsor" or "spender"; it follows the word list in `design-system/guidelines/10-content.md`. Fee top-ups show as "Fee credit added". Where a PRD error message (Section 7.5) differs from the design system's Errors table, the design system's wording wins. PRD-only messages are rewritten in the same voice (for example `FuelOutOfRange()` becomes "The fee credit can be at most $0.50."). Internal code names stay as specified. |
| D2 | The sponsor's request actions are `approveRequest(uint256)` and `declineRequest(uint256)`, so they cannot be confused with ERC-20 `approve`. Events stay `Approved` and `Declined`. |
| D3 | `uint8 icon` and `uint8 hue` are added to `Pocket` and `CreateParams`, validated (`icon < 10`, `hue < 6`, else `BadAppearance()`) and included in `PocketCreated`. Order of icons: graduation-cap, bowl-food, house-line, first-aid-kit, lightning, device-mobile, bus, shopping-bag, hand-heart, piggy-bank. Order of hues: palm, sky, clay, teal, plum, olive. |
| D4 | Nicknames for addresses ("Mama") are saved only in the browser's `localStorage`, never on-chain. Show a nickname wherever one exists, otherwise `shortAddress`. |
| D5 | `available(id)` returns min(limit minus spent this period after a virtual period roll, balance), and 0 for request-only pockets. |
| D6 | Every write: `maxPriorityFeePerGas` = 1 gwei; `maxFeePerGas` = max(25 gwei, 2 x latest base fee + 1 gwei). In the app and in Foundry commands. |
| D7 | Estimate gas and add 20%. If estimation fails, use fixed fallbacks. PRD fallbacks are floors; after the gas report each fallback becomes the measured worst case (10 payees, 32-byte label, 64-byte memo) plus 30%. |
| D8 | Plain CSS with the design system only. No Tailwind, no other UI kit or icon set. Never hard-code a colour or font size. |
| D9 | Hash routes. Sender: `/#/send`, `/#/requests`, `/#/activity`, `/#/new`, `/#/p/:id`. Family: `/#/family`, `/#/family/activity`. Shared: `/#/`, `/#/view/:id`, `/#/settings`. `/#/new` and Pay or Ask are full task screens below 600px and a `Sheet` from 600px, and stay linkable. |
| D10 | Navigation matches the Screens previews. Sender: Pockets, Requests (pending count), Activity, Settings. Family: Home, Activity, Settings. A spend-only wallet lands on `/#/family`; any other wallet on `/#/send`. A wallet with both roles switches views in Settings. |
| D11 | Family link `<origin>/#/family`. Public link `<origin>/#/view/:id`. Co-funders add money from the public page after connecting, and are warned first that the pocket's creator can take that money back. |
| D12 | A phone with no injected wallet sees one line on opening Earmark in the MetaMask, OKX or Bitget in-app browser, and a "Copy link" action. |
| D13 | USDC stays `bigint` in 6-decimal base units from the contract to the component boundary; `formatUnits(value, 6)` only for display. Never read the 18-decimal native balance. |

## Conflicts and gaps found in Phase 0

Status: **Resolved** (choice made, cheap to change) or **Open** (needs the product owner).

### Contract

| # | Conflict or gap | Resolution | Status |
| --- | --- | --- | --- |
| C1 | PRD Section 7.2 lists `setPayee`, `setLimit` and `cancelRequest` as P1 inside an **immutable** contract, and the Section 11.1 request tests include "cancel". Adding them after mainnet means a new contract address, which would strand the 3 demo pockets. | The product owner approved the recommendation on 29 Sep 2026: the three functions are in the contract, fully tested, with no screens until the owner approves P1 screens. The activity feed shows their events. | Resolved |
| C2 | The constructor must revert unless `usdc.decimals() == 6`, but Section 7.5 has no error for it. | Add `BadToken()`, used only by the constructor. It is never shown to users. | Resolved |
| C3 | "Fuel bounds" are not defined precisely. | `fuelTarget <= 500_000` and `fuelCapPerPeriod <= 1_000_000`, else `FuelOutOfRange()`. The app sets the cap to 2 x target (default $0.10), capped at $1.00, so only the target is ever user-editable and the D1 message stays accurate. | Resolved |
| C4 | `_refuel` runs after `request` and uses `fuelUsedInPeriod`, but the PRD only says `spend` rolls the period. A stale period would let the cap block top-ups for ever. | Roll the period in `spend`, `request` and `createPocket` (before `_refuel`). | Resolved |
| C5 | A zero top-up (empty pocket, cap used, or balance already high) would emit an empty `Refuelled`. The same for a zero deposit on create. | Skip the transfer and the event when the amount is 0. A pocket may be created with a 0 deposit; it then emits no `Funded`. | Resolved |
| C6 | `spend`, `fund` and `withdraw` do not state an "amount above 0" check. | All four money-moving calls revert `InvalidAmount()` on 0. | Resolved |
| C7 | Duplicate addresses in the `payees` array at creation are not covered. | Duplicates are ignored (stored and announced once). The app prevents them anyway. | Resolved |
| C8 | `extendLock` when there is no lock (0), or after a lock has passed. | Allowed, as long as the new date is later than the current `lockUntil`, in the future, and at most 730 days ahead (`BadLock()` if not in the future or too far; `LockNotExtended()` if not later). The P0 app offers "Move lock date later" only on locked pockets. | Resolved |
| C9 | Labels and memos are limited in **bytes**, but the PRD and design system say "characters". Yoruba, Igbo and Hausa letters with marks take 2 to 3 bytes each. | Contract checks bytes. The app counts UTF-8 bytes with `TextEncoder`, blocks input past the limit, and says "Letters with accents take more space" in the hint only when the name contains them. | Resolved |
| C10 | Sponsor and spender may be the same address; spend to self is not covered. | Allowed. A spender paying their own address is how cash-out to a personal wallet works. D10 covers a wallet with both roles. | Resolved |

### Copy and screens

| # | Conflict or gap | Resolution | Status |
| --- | --- | --- | --- |
| C11 | PRD Section 7.5 messages versus the design system's Errors table. | D1: design-system wording where both exist. Full mapping lives in `web/src/copy.ts` (Phase 3). Key cases: `OverLimit` becomes "Only {amount} is available {period}. Ask for approval instead."; `PayeeNotApproved` becomes "This pocket only pays approved people. Ask for approval instead."; `MemoTooLong` becomes "Keep the note to 64 characters or fewer." (the PRD's "under 64" was off by one). | Resolved |
| C12 | The design system's bad-address message ("not a full Arc address") is for format errors. The contract's `InvalidAddress()` means the zero address or Earmark itself, where that message would be wrong. | Format errors are caught in the app with the design-system message. The contract error maps to "Earmark cannot pay this address. Check it and try again." | Resolved |
| C13 | The PRD allows any period of 1 to 31 days; the design system offers a `SegmentedControl` (Daily, Weekly, Monthly), and its copy says "this week" and "Resets Monday". | The control offers Day (1), Week (7) and Month (30 days). Period words follow the length ("today", "this week", "this month", else "this period"). Resets are computed from the on-chain `periodStart`, not calendar weeks: "Resets Monday" (week), "Resets 2:14 pm" (day), "Resets 29 Oct" (month). The limit field is labelled "Daily limit", "Weekly limit" or "Monthly limit". | Resolved |
| C14 | The design system's pocket page shows "Approved payees (with Remove)", but removing a payee (`setPayee`) is P1. | P0 shows the approved payees as a read-only list, with no Remove action. | Resolved |
| C15 | P1 lists "Share link and QR code for a pocket", but D11 and the design system (New pocket end state, "Share family link", pocket page Share button) need links in P0. | P0 ships copy and native share of the family and public links. No QR code (P1). | Resolved |
| C16 | PRD Section 6 asks for "gas status" on the family home; the design system shows one caption line about fees and no per-card status. | The family home caption shows the family member's current fee credit, read from USDC `balanceOf` (D13): "Fee credit: $0.05. Network fees come out of your pockets. You never need to buy anything else." | Resolved |
| C17 | PRD US-10 wants naira "marked indicative with its time"; `Money` shows "≈ ₦" only, and `AmountInput` shows "indicative" without a time. | One caption per screen that shows naira: "Naira amounts are indicative, at the {date} rate." The time is the provider's own update time, not the fetch time. `AmountInput` keeps its "indicative" word, and `RequestCard` screens carry the caption. | Resolved |
| C18 | The exchange-rate provider's free terms require the link "Rates By Exchange Rate API" wherever its rates are used. The design system has no slot for it. | The naira caption (C17) ends with that link, set as a discreet `ek-link`. | Resolved |
| C19 | The family home lede names the sender ("Ṣadé fills these pockets"), but the family device may have no nickname for the sender. | With a nickname: "{name} fills these pockets. Pay from them whenever you need to." Without: "Pay from these pockets whenever you need to." Settings lets the family member name the sender. | Resolved |
| C20 | The landing page links to "a live demo pocket" and, on expanded screens, shows "a real `PocketCard`". The four required environment variables have no demo pocket, and shipped screens may not use fake data. | Add an optional `VITE_DEMO_POCKET_ID`. When it is set, the landing reads that pocket from Arc for the card and the "See a live pocket" link. When it is unset or unreadable, both are left out. The card's Pay and Ask open the public page. | Resolved |
| C21 | PRD "three UI states" versus the design system's four (with Failed). | Four states, as the design system specifies. | Resolved |
| C22 | The design system says "Store only the theme preference". D4 stores nicknames. The PRD caches the rate for an hour. | `localStorage` holds only: the theme, nicknames (D4), the last naira rate with its time, and the chosen view for dual-role wallets. No personal data leaves the device. | Resolved |
| C23 | The PRD says "View a live demo pocket" and "Withdraw"; the design system says "See a live pocket" and "Take money back". | Design-system wording (D1). | Resolved |
| C24 | The New pocket form asks for the family member's address "or a saved name", but there is nowhere to create that name. | An optional "Their name (only on this device)" field under the address saves a D4 nickname. | Resolved |
| C25 | Minimum fee credit. A wallet must hold `gasLimit x maxFeePerGas` up front. At D6's 41 gwei and a ~300,000 gas limit that is about $0.012. A very small fee credit (such as $0.01) could leave the family member unable to pay the network fee. | The app offers the fee credit as off or $0.05 to $0.50 (default $0.05, with top-ups below $0.025). The contract keeps the PRD's bounds (0 to $0.50). Re-check against measured gas in Phase 1. | Resolved |

### Environment and repository

| # | Conflict or gap | Resolution | Status |
| --- | --- | --- | --- |
| C26 | The Arc Microgrants Q&A says mainnet RPC providers are permissioned during the "private mainnet phase". | Checked on 28 Sep 2026: `https://rpc.mainnet.arc.io` answers anonymous, cross-origin requests (chain 0x13b2, CORS on). The app keeps the RPC URL configurable, as the PRD already requires. | Resolved |
| C27 | `eth_getLogs` rejects spans of 10,000 blocks or more. The PRD's live poll ("from the last seen block to latest") can exceed that after a tab sleeps. | Live poll windows are capped at 2,000 blocks; a longer gap is walked in chunks, or the back-pointer walk reloads the feed. | Resolved |
| C28 | Arc's public RPC is load balanced, and backends can briefly disagree about the head (`-32014`). | Reads retry with backoff, and a read after a write waits for the receipt block to be available. | Resolved |
| C29 | The PRD says `forge verify-contract` for Blockscout. The explorer's API is behind a Cloudflare challenge (arc-node #425 and #454). | Phase 7: verify on Sourcify (`--verifier sourcify`), try the explorer's web form by hand, and commit the standard JSON input either way (PRD Section 12, step 15). | Resolved |
| C30 | `docs/PRD.md` carries the product owner's full name, and `notes/base_idea.md` mentions a pseudonym. The repository will be public. | The owner asked for the safest option (29 Sep 2026): the PRD byline is the public GitHub handle `@adamtosho`, so the full legal name never enters the public history. The PDF and working notes stay in git-ignored `notes/`; `LICENSE` names "Earmark contributors". | Resolved |
| C31 | The PRD's `forge init contracts` would create a nested Git repository. | Hand-write `contracts/foundry.toml` and install `forge-std` and OpenZeppelin as submodules of the root repository. | Resolved |

## Choices made in Phase 1

| # | Choice | Reason | Status |
| --- | --- | --- | --- |
| C32 | `payeeOnly`, `icon` and `hue` sit right after `sponsor` in `Pocket`, not at the end. | They pack into the sponsor's storage slot and save a slot per pocket. The ABI tuple order changes; the app reads fields by name. | Resolved |
| C33 | `createPocket` is split into private helpers (`_store`, `_emitCreated`, `_addPayees`). | The 10-field event plus the struct hit "stack too deep". Helpers avoid switching to `via_ir`, which the PRD's build settings do not include and which would complicate source verification. | Resolved |
| C34 | For an id that was never used, `getRequest`, `approveRequest` and `declineRequest` revert `NotPending()`. | The PRD has no "unknown request" error. The app never asks about ids it has not read, so users do not see this. | Resolved |
| C35 | Three Slither mediums (one `divide-before-multiply`, two `incorrect-equality`) are reviewed false positives, suppressed on their lines with the reason. | Details and the raw findings are in `docs/SECURITY.md`. A `%` rewrite was tried and triggered `weak-prng` (High), so the standard idiom stayed. | Resolved |
| C36 | `Deploy.s.sol` refuses any chain other than 5042 or 5042002, and any USDC address other than `0x3600…0000`. | A wrong RPC or `.env` cannot deploy Earmark against the wrong token or network. | Resolved |
| C37 | Fallback gas limits (D7): approve 100,000; create 1,225,000; fund 150,000; spend 250,000; request 455,000; approve request 200,000; decline 95,000; withdraw 130,000; extend lock 85,000. | Measured worst case plus 30%, never below the PRD floors (`docs/GAS.md`). To be re-checked with `eth_estimateGas` against Arc's real USDC after the testnet deploy. | Resolved |

## Choices made in Phases 3 and 4

| # | Choice | Reason | Status |
| --- | --- | --- | --- |
| C38 | TypeScript 6.0.3, not 7.0.2. | typescript-eslint 8.70 (current) supports TypeScript below 6.1 only; type-aware linting matters more than the newest compiler. | Resolved |
| C39 | Pay and Ask have routes: `/#/family/pay/:id` and `/#/family/ask/:id`. | D9 requires Pay or Ask to stay linkable; D9 lists no path for them. | Resolved |
| C40 | EIP-6963 wallet discovery is off; the injected connector uses `window.ethereum`. | One "Connect wallet" button, no wallet picker; in-app wallet browsers set `window.ethereum`. | Resolved |
| C41 | wagmi keeps its own connection state in `localStorage` (`wagmi.*` keys) so a reload reconnects. | Needed for a usable app; it holds only the connector id and the public address. Adds to C22. | Resolved |
| C42 | Every write is simulated (`eth_call`) before the wallet prompt, and gas is estimated only after. | A call that would fail is explained and never sent, so nobody pays a fee for a doomed payment. Stronger than the PRD's estimate-then-fallback. | Resolved |
| C43 | The compliance message has two forms: before sending ("…block this address. Nothing was sent.") and after ("…The network fee was still charged."). | The design system's single sentence is only true once a payment was sent. | Resolved |
| C44 | ESLint's `react-refresh/only-export-components` is off. | Small hooks sit beside their components; the rule only affects development hot reload. | Resolved |
| C45 | Reads are batched through Multicall3 (`0xcA11…CA11`) and JSON-RPC batches. | Verified deployed on both Arc networks (3,808 bytes). Cuts RPC calls on patchy mobile data. | Resolved |
| C46 | The live poll starts 120 blocks behind the head, runs every 2 s only while the page is visible, and catches up on return. | No gap between first reads and the first poll; no battery drain in a background tab. | Resolved |
| C47 | New pocket suggests an icon (and its default hue) from words in the name, until the sender picks one. | Faster setup; covers English and common Yoruba, Hausa and Igbo words. | Resolved |
| C48 | The New pocket fee preview uses typical gas (docs/GAS.md) times the current base fee plus the tip, shown as "about". | An exact estimate is impossible before the allowance exists. | Resolved |
| C49 | Local end-to-end rehearsal: anvil with chain id 5042002 and a 20 gwei base fee, the 6-decimal mock USDC placed at `0x3600…0000`, Multicall3 copied from Arc testnet, and a test-only wallet over anvil's unlocked accounts (`scripts/local-chain.sh`, `web/e2e/`). | Exercises the real app end to end before testnet. On anvil, fees are paid in ETH, so the fee credit is not drawn down locally; Arc testnet confirms that part. | Resolved |
| C50 | The submission says fees are "about a fifth of a cent per payment", not the PRD's "a tenth of a cent". | Measured: a spend within the rules uses about 90,000 gas (docs/GAS.md), which is about $0.0019 at 20 gwei plus a 1 gwei tip. Arc's target of about $0.001 applies to a plain ERC-20 transfer. | Resolved |
| C51 | `Deploy.s.sol` signs with `PRIVATE_KEY` when it is set, and otherwise with Foundry's signer, so an encrypted keystore (`--account`) works. `USDC` defaults to `0x3600…0000`. | No plaintext key needs to exist on disk (docs/DEPLOY.md option A). Tested on a local chain; a chain id 1 node is refused with "Deploy: not an Arc network". | Resolved |

## Choices made adding the P1 contract functions (29 Sep 2026)

| # | Choice | Reason | Status |
| --- | --- | --- | --- |
| C52 | `setPayee` to the state a payee already has changes nothing and emits nothing. Removing swaps the last payee into the gap, so `payeesOf` order can change. At most 10 payees are active at once; removing one frees a slot. | No noise in the feed, and a bounded list (at most 10, so the search is cheap). | Resolved |
| C53 | `setLimit` rolls the period first, then sets the limit. Spending so far this period still counts, so lowering the limit below what was spent leaves nothing more to spend until the next period. | PRD Section 7.2 wording. This means `spentInPeriod` can sit above a lowered limit for the rest of that period. Invariant 2 is therefore checked as: no spend ever takes spending above the limit in force, and it sits above the limit only in a period in which the sponsor lowered it (then `available` is 0). | Resolved |
| C54 | `cancelRequest` is callable only by the pocket's spender, only while the request is pending, and frees a pending slot. | PRD Section 7.2. It counts as the request's one exit from Pending (invariant 7). | Resolved |
| C55 | EIP-6963 wallet discovery is **on** (replaces C40). Each installed wallet is its own connector; with one wallet "Connect wallet" goes straight to it, with several it asks "Choose your wallet". The generic injected connector remains for in-app browsers that only set `window.ethereum`. | In the owner's testnet rehearsal (29 Sep 2026), Connect always failed with "You cancelled in your wallet" and no MetaMask window: another extension held `window.ethereum`. Reproduced and fixed in `web/e2e/multi-wallet.mjs`. | Resolved |
| C56 | A pocket created with no deposit never tops up the family member, and `fund` did not either. On the 29 Sep testnet rehearsal, pocket 1 ("Food") was created empty, Mama held 0 USDC, and she could not spend or request. That breaks US-07. | The owner approved the fix on 30 Sep 2026. `fund` rolls the period, then calls `_refuel` with the same half-float rule and the same per-period cap as `spend` and `request`. The roll is required: without it a used cap would block later top-ups for ever (the same reason as C4). A zero top-up still emits nothing (C5), and top-ups still never count against the spending limit. Redeployed on Arc testnet on 1 Oct 2026 at `0x68C480758172bBC94858B98F6E5E356FA30e3080`, block 64978753, replacing the 29 Sep contract. The `fund` fallback rises from 150,000 to 175,000: measured worst case 131,828 plus 30%, rounded up to the next 5,000 (docs/GAS.md). | Resolved |
