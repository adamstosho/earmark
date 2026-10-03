# Earmark PRD: Purpose-Bound USDC Pockets on Arc

Sep 27, 2026 · @adamtosho

## 1. Summary and goals

Earmark lets people abroad fund labelled USDC pockets on Arc mainnet (school fees, food, rent, emergency) that family members spend under rules the sender sets. The MVP is one Solidity contract plus one static web app, live on Arc mainnet by Saturday 3 October 2026 and submitted to Arc Microgrants by Sunday 4 October 2026.

**One-liner:** Purpose-bound USDC pockets for money sent home, settled on Arc.

**Working name:** Earmark. Fallback name: Àpò (Yoruba for "pocket"). Check GitHub and X availability before Day 1 ends.

| ID | Goal | Done when |
| --- | --- | --- |
| G1 | A working product on Arc mainnet | Contract live on chain 5042, at least 3 real pockets and at least 10 real transactions covering create, fund, spend, request, approve and withdraw |
| G2 | A complete, eligible submission | Live URL, public repo, description and builder profile submitted on DoraHacks by 4 October (hard deadline 14 October, 23:59 ET) |
| G3 | Technical credibility | Foundry unit, fuzz and invariant tests pass; Slither shows no high or medium findings; every Arc gotcha in Section 8 handled |
| G4 | Obvious Arc relevance | Three features that only make sense on Arc: self-fuelling gas float, instantly final spend feed, dollar-denominated fees |
| G5 | Near-zero cost | Only free tooling; total mainnet spend under 0.25 USDC |

**Non-goals for the MVP**

- No fiat on-ramp or off-ramp, no FX, no custody by the builder and no fees charged to users.
- No token, no governance, no AI agents.
- No native mobile app; a mobile-first web app only.
- No backend server or database; the chain is the only data store.

## 2. Problem and evidence

Once money sent home lands, the sender loses all say over how it is used; Earmark restores that say without anyone taking custody of the funds.

**Problem statement:** A sender abroad has no low-cost way to direct, monitor and, where needed, commit money to specific household purposes after it arrives.

| Evidence | Figure | Source |
| --- | --- | --- |
| Remittances into Nigeria, 2025 | About $21.8 billion (CBN data) | [Vanguard, May 2026](https://www.vanguardngr.com/2026/05/diaspora-remittances-stabilises-at-21-8bn-in-2025-amid-global-pressures/) |
| Cost of sending $200 to Sub-Saharan Africa, Q1 2025 | Close to 9%, against 6.4% globally and an SDG target of 3% | [UN DESA, Nov 2025](https://policy.desa.un.org/publications/world-economic-situation-and-prospects-november-2025-briefing-no-196) |
| Effect of letting migrants label remittances for education | More than 15% more sent (708 vs 615 euros of a possible 1,000); paying the school directly added only 2.2% more | [J-PAL summary of De Arcangelis et al. (2015)](https://povertyactionlab.org/evaluation/increasing-development-impact-migrant-remittances-field-experiment-educational-finance) |
| Regulatory precedent | Singapore's Purpose Bound Money wraps money with purpose logic without programming the money itself | [MAS PBM whitepaper, June 2023](https://www.mas.gov.sg/-/media/mas-media-library/development/fintech/pbm/pbm-technical-whitepaper.pdf) |
| Circle's stated demand | Request for Builders names local-market financial platforms and a "family personal office" | [Team Arc, 16 Sep 2026](https://www.arc.io/blog/the-unfinished-business-of-finance-machine-commerce-and-global-money) |

**Design implications**

1. Labels are the core feature and hard locks are optional, because the evidence shows most of the effect comes from the label.
2. Rules wrap standard USDC; money that leaves a pocket is ordinary USDC with no strings attached, as in the PBM model.
3. Sender visibility is part of the value, so every movement must be visible to the sender within seconds.

## 3. Users and personas

Five roles use Earmark; the sender and the family spender are the two the MVP must delight.

| Role | Example | What they need | Actions in the app |
| --- | --- | --- | --- |
| Sender (sponsor) | Nurse in Manchester supporting her mother | Direct money to purposes, see every spend, approve large items, protect school fees from impulse withdrawals | Create pocket, fund, set rules, approve or decline requests, withdraw, extend lock |
| Family spender | Mother in Ilorin on a mid-range Android phone | Pay simply, never get stuck on gas, see balances in naira, ask for more when needed | Spend within rules, request above rules |
| Co-funder | Brother in Houston | Top up the same pocket and see where it goes | Fund |
| Payee | School bursar, landlord, trader, or an exchange deposit address for cash-out | Receive USDC that is final at once | Receive only |
| Reviewer | Arc Microgrants judge | Confirm in a few minutes that it runs on mainnet and uses Arc properly | Open the live URL, the public pocket page and explorer links without a wallet |

**Design constraints from the spender persona:** low crypto literacy, small screens (360 px wide), patchy mobile data and no appetite for seed-phrase jargon. Copy must use plain words such as "Available this week" and "Ask for more".

## 4. Scope

P0 items ship before submission; P1 items ship only if P0 is done and tested by Friday 2 October; everything in "Out" waits for after the grant.

| Priority | Feature |
| --- | --- |
| P0 | Create a pocket with label, spender, weekly limit, period length, payee-only switch, approved payees, optional commitment lock and gas float |
| P0 | Fund a pocket from any wallet (sender or co-funders) |
| P0 | Spend within the rules, final in one transaction |
| P0 | Request above the rules; sender approves or declines |
| P0 | Sender withdraws unspent funds, blocked while a commitment lock runs; lock can be extended, never shortened |
| P0 | Gas float: the pocket keeps the spender's wallet topped up with a few cents of USDC |
| P0 | Sender dashboard, family view, public read-only pocket page, live activity feed |
| P0 | Indicative naira amounts beside USDC |
| P0 | One config switch between Arc testnet and Arc mainnet |
| P0 | README, test suite, friction log, demo video |
| P1 | Add or remove payees and change the weekly limit after creation |
| P1 | Spender cancels own pending request |
| P1 | Share link and QR code for a pocket |
| P1 | CSV export of a pocket's activity |
| Out | Fiat on-ramp or off-ramp, FX and EURC, passkey wallets, SMS or email alerts, opt-in privacy, AI agent spenders, native app, backend server |

## 5. User stories and acceptance criteria

Eleven P0 stories define the MVP; each is done only when every acceptance criterion passes on Arc testnet and again on mainnet.

1. **US-01 Create a pocket.** As a sender, I want to create a labelled pocket so that money I send has a purpose.
   - Fields: label (1 to 32 characters), spender address, weekly limit in USDC (0 means request-only), period length (default 7 days, allowed 1 to 31 days), payee-only switch with up to 10 payees, optional lock date (at most 2 years ahead), gas float (default 0.05 USDC, maximum 0.50), initial deposit.
   - Flow is two transactions: an exact-amount USDC approval, then create. No unlimited approvals.
   - The pocket appears on the dashboard within 2 seconds of the create transaction's receipt.
2. **US-02 Fund a pocket.** As a sender or co-funder, I want to add USDC to any pocket I can see.
   - Anyone may fund; the UI warns co-funders that the pocket's sender can withdraw what they add.
   - The balance and feed update within 2 seconds of the receipt.
3. **US-03 Spend within rules.** As a spender, I want to pay someone from a pocket in one step.
   - Allowed only if the amount is at most what is left this period and at most the balance; if payee-only is on, the recipient must be approved.
   - Memo is optional, at most 64 bytes, and the UI says memos are public.
   - If the amount is too high, the button changes to "Ask for approval" rather than failing.
4. **US-04 Request above rules.** As a spender, I want to ask for a larger or unplanned payment.
   - A request records recipient, amount and memo, and may name any recipient; the sender's approval is the check.
   - At most 20 pending requests per pocket.
5. **US-05 Approve a request.** As a sender, I want to approve a request so the payee is paid at once.
   - Approval pays the recipient in the same transaction; it fails cleanly if the balance is short.
   - Approved amounts do not count against the weekly limit.
6. **US-06 Decline a request.** As a sender, I want to decline a request; the money stays in the pocket.
7. **US-07 Never stuck on gas.** As a spender, I never need to buy a gas token.
   - On creation, and after each spend or request, if the spender's USDC balance is below half the gas float, the pocket tops it up to the float, within a per-period fuel cap (default 0.10 USDC).
   - Every top-up emits an event and shows in the feed as "Gas top-up".
8. **US-08 Withdraw.** As a sender, I want to take back unspent money.
   - Allowed any time when there is no lock; blocked until the lock date when there is one, with the date shown in the UI.
   - The lock can be extended, never shortened.
9. **US-09 Public pocket page.** As a reviewer or relative, I can open a read-only pocket page with no wallet connected.
10. **US-10 Naira display.** As a spender, I see an indicative naira figure beside every USDC amount, marked "indicative" with its time; the app still works if the rate service is down.
11. **US-11 Right network.** As any user, if my wallet is on another chain, the app offers to add or switch to Arc in one tap.

## 6. Product flows and screens

Money can leave a pocket in only three ways: a spend within the rules, an approved request, or a sender withdrawal after any lock ends.

&#91;embedded content: pocket payout flow · 2 paths, 1 decision\]

The family spender starts both payout paths. Separately, the pocket tops up the spender's wallet with a small USDC gas float, and the sender can withdraw unspent funds unless a commitment lock is running.

| Screen | Route | Who | Must show |
| --- | --- | --- | --- |
| Landing | `/#/` | Everyone | One-line pitch, three-step "how it works", Connect wallet, "View a live demo pocket" link |
| Sender dashboard | `/#/send` | Sender | Pocket cards (label, balance in USDC and naira, spent this period, pending-request badge), New pocket button, live activity feed |
| New pocket | `/#/new` | Sender | Form from US-01, fee preview in USDC, two-step progress (Approve, then Create) |
| Pocket detail | `/#/p/:id` | Sender | Balance, rules summary, Fund, Withdraw (disabled with the lock date when locked), pending requests with Approve and Decline, feed with explorer links |
| Family home | `/#/family` | Spender | One large card per pocket with "Available this week", Pay and Ask buttons, gas status |
| Pay or Ask sheet | Modal | Spender | Recipient (pick from approved payees or paste an address), amount, memo, a plain-English rule message |
| Public pocket | `/#/view/:id` | Anyone | Read-only balance, rules and feed; no wallet needed |

**UI rules for every screen**

- Mobile-first at 360 px, tap targets at least 44 px, one primary action per screen.
- Every transaction shows three states: waiting for wallet, submitted, final (with an explorer link).
- Every contract error maps to one plain-English sentence (see the error table in Section 7).
- Hash routes (`/#/...`) so the app runs on any static host with no server rewrites.

## 7. Smart contract specification

One immutable contract, `EarmarkPockets`, holds every pocket; it has no owner, no admin keys, no pause and no upgrade path, and it moves USDC only through Arc's ERC-20 interface.

**Build settings:** Solidity 0.8.28, optimizer on (200 runs), `evm_version = "cancun"`, OpenZeppelin Contracts 5.x (`SafeERC20`, `ReentrancyGuard`), MIT licence.

**Constructor:** `constructor(IERC20Metadata usdc)` stores USDC as immutable and reverts unless `usdc.decimals() == 6`. Deploy with `0x3600000000000000000000000000000000000000`.

### 7.1 Data model

```solidity
struct Pocket {
    address sponsor;          // creator: sets rules, approves, withdraws
    address spender;          // family member who pays from the pocket
    uint128 balance;          // USDC, 6 decimals
    uint128 limitPerPeriod;   // 0 = request-only pocket
    uint128 spentInPeriod;
    uint128 fuelTarget;       // gas float, max 500_000 (0.50 USDC)
    uint128 fuelCapPerPeriod; // max top-ups per period, max 1_000_000 (1.00 USDC)
    uint128 fuelUsedInPeriod;
    uint64  periodLength;     // seconds, 1 to 31 days
    uint64  periodStart;
    uint64  lockUntil;        // 0 = no commitment lock
    uint64  lastEventBlock;   // back-pointer that powers the activity feed
    bool    payeeOnly;
    string  label;            // 1 to 32 bytes
}

enum Status { None, Pending, Approved, Declined, Cancelled }

struct Request {
    uint256 pocketId;
    address to;
    uint128 amount;
    Status  status;
    string  memo;             // max 64 bytes
}

struct CreateParams {
    address spender;
    string  label;
    uint128 limitPerPeriod;
    uint64  periodLength;
    uint64  lockUntil;
    bool    payeeOnly;
    uint128 fuelTarget;
    uint128 fuelCapPerPeriod;
    uint128 deposit;          // pulled with transferFrom; needs a prior approve
}
```

Storage indexes: `pockets[id]`, `requests[id]` (both start at 1), `isPayee[pocketId][addr]`, `payeeList[pocketId]`, `pocketsBySponsor[addr]`, `pocketsBySpender[addr]`, `requestsByPocket[pocketId]`, `pendingCount[pocketId]`.

### 7.2 Write functions

| Function | Caller | Checks | Effects | Events |
| --- | --- | --- | --- | --- |
| `createPocket(CreateParams p, address[] payees) returns (uint256 id)` | Anyone; becomes sponsor | Spender not zero; label 1 to 32 bytes; period 1 to 31 days; lock is 0 or in the future and at most 730 days ahead; fuel bounds; at most 10 payees, none zero | Stores pocket with `periodStart = block.timestamp`; pulls deposit and credits the balance delta; sets payees; first gas top-up | `PocketCreated`, `PayeeSet`, `Funded`, `Refuelled` |
| `fund(uint256 id, uint128 amount)` | Anyone | Pocket exists; amount above 0 | `transferFrom` caller; balance increases by the delta actually received; rolls the period, then the same gas top-up as spend (C56) | `Funded`, `Refuelled` |
| `spend(uint256 id, address to, uint128 amount, string memo)` | Spender | Rolls the period; valid recipient; approved payee if `payeeOnly`; amount at most `limitPerPeriod - spentInPeriod` and at most balance; memo at most 64 bytes | Updates `spentInPeriod` and balance, then transfers; then gas top-up | `Spent`, `Refuelled` |
| `request(uint256 id, address to, uint128 amount, string memo)` | Spender | Valid recipient (any payee allowed); amount above 0; fewer than 20 pending; memo at most 64 bytes | Stores a Pending request; gas top-up | `Requested`, `Refuelled` |
| `approve(uint256 requestId)` | Sponsor | Status Pending; amount at most balance | Status Approved; balance decreases; transfers to recipient; does not touch the period limit | `Approved` |
| `decline(uint256 requestId)` | Sponsor | Status Pending | Status Declined | `Declined` |
| `withdraw(uint256 id, uint128 amount, address to)` | Sponsor | `block.timestamp >= lockUntil`; amount at most balance; valid recipient | Balance decreases; transfers | `Withdrawn` |
| `extendLock(uint256 id, uint64 newLock)` | Sponsor | New lock later than the current one and at most 730 days ahead | Updates `lockUntil` | `LockExtended` |
| `setPayee(uint256 id, address payee, bool allowed)` (P1) | Sponsor | Valid address; at most 10 active payees | Updates payee flags and list | `PayeeSet` |
| `setLimit(uint256 id, uint128 limit)` (P1) | Sponsor | None beyond ownership | Updates `limitPerPeriod`; spending so far this period still counts | `LimitChanged` |
| `cancelRequest(uint256 requestId)` (P1) | Spender | Status Pending | Status Cancelled | `Cancelled` |

A valid recipient is never the zero address and never the contract itself. Every write function is `nonReentrant`, follows checks, effects, then interactions, and uses `SafeERC20`. No function is `payable` and there is no `receive()`, so native value sent to the contract reverts.

**Period roll:** if `block.timestamp >= periodStart + periodLength`, move `periodStart` forward by whole periods and reset `spentInPeriod` and `fuelUsedInPeriod` to zero.

**Gas top-up (`_refuel`):** if `fuelTarget > 0` and `USDC.balanceOf(spender) < fuelTarget / 2`, send `min(fuelTarget - spenderBalance, fuelCapPerPeriod - fuelUsedInPeriod, pocket.balance)` to the spender, add it to `fuelUsedInPeriod`, and emit `Refuelled`. Top-ups come from the pocket balance and never count against the spending limit.

### 7.3 Read functions

`getPocket(id)`, `available(id)` (applies the period roll virtually), `payeesOf(id)`, `isPayee(id, addr)`, `pocketsOfSponsor(addr)`, `pocketsOfSpender(addr)`, `requestsOf(id)`, `getRequest(requestId)`, `pendingCount(id)`.

### 7.4 Events

Every pocket event after PocketCreated carries `prevEventBlock`, the block number of that pocket's previous event, and the contract then sets `lastEventBlock` to the current block. The app rebuilds a pocket's history by walking these pointers one block at a time (Section 8), so no one ever scans large block ranges.

```solidity
event PocketCreated(uint256 indexed pocketId, address indexed sponsor, address indexed spender, string label, uint128 limitPerPeriod, uint64 periodLength, uint64 lockUntil, bool payeeOnly);
event Funded(uint256 indexed pocketId, address indexed from, uint128 amount, uint64 prevEventBlock);
event Spent(uint256 indexed pocketId, address indexed to, uint128 amount, string memo, uint64 prevEventBlock);
event Requested(uint256 indexed pocketId, uint256 indexed requestId, address to, uint128 amount, string memo, uint64 prevEventBlock);
event Approved(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
event Declined(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
event Cancelled(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
event Withdrawn(uint256 indexed pocketId, address indexed to, uint128 amount, uint64 prevEventBlock);
event Refuelled(uint256 indexed pocketId, address indexed spender, uint128 amount, uint64 prevEventBlock);
event LockExtended(uint256 indexed pocketId, uint64 lockUntil, uint64 prevEventBlock);
event PayeeSet(uint256 indexed pocketId, address indexed payee, bool allowed, uint64 prevEventBlock);
event LimitChanged(uint256 indexed pocketId, uint128 limitPerPeriod, uint64 prevEventBlock);
```

### 7.5 Custom errors and UI messages

| Error | Message shown to the user |
| --- | --- |
| `NotSponsor()` | Only the person who created this pocket can do that. |
| `NotSpender()` | Only the family member on this pocket can pay from it. |
| `UnknownPocket()` | This pocket does not exist. |
| `InvalidAddress()` | Check the recipient address. |
| `InvalidAmount()` | Enter an amount above zero. |
| `BadLabel()` | The label must be 1 to 32 characters. |
| `MemoTooLong()` | Keep the note under 64 characters. |
| `BadPeriod()` | The period must be between 1 and 31 days. |
| `BadLock()` | The lock date must be in the future and within two years. |
| `LockNotExtended()` | You can only move the lock date later. |
| `Locked(uint64 until)` | This pocket is locked until {date}. |
| `OverLimit(uint128 available)` | Only {amount} is available this period. Ask for approval instead. |
| `InsufficientBalance(uint128 balance)` | The pocket only holds {amount}. |
| `PayeeNotApproved()` | This pocket only pays approved recipients. Ask for approval instead. |
| `TooManyPayees()` | A pocket can have up to 10 approved recipients. |
| `TooManyPending()` | There are already 20 requests waiting. |
| `NotPending()` | This request has already been handled. |
| `FuelOutOfRange()` | The gas float can be at most 0.50 USDC. |

### 7.6 Invariants (tested in Section 11)

1. `USDC.balanceOf(contract)` is always at least the sum of all pocket balances.
2. `spentInPeriod` never exceeds `limitPerPeriod` within a period.
3. `fuelUsedInPeriod` never exceeds `fuelCapPerPeriod` within a period.
4. No withdrawal succeeds while `block.timestamp < lockUntil`.
5. `lockUntil` never decreases.
6. Only the spender can spend or request; only the sponsor can approve, decline, withdraw or change rules.
7. A request leaves Pending at most once.

**Known limitations (state them in the README):** USDC sent straight to the contract without `fund` is not credited to any pocket and cannot be recovered; co-funders' deposits are withdrawable by the sponsor; the contract cannot be paused or upgraded, so the UI must advise small amounts during the proof of concept.

## 8. Arc integration requirements

Arc is EVM-compatible but differs from Ethereum in ways that silently break naive builds; each row below is a hard requirement with its implementation.

| ID | Arc fact | Requirement for Earmark | Source |
| --- | --- | --- | --- |
| A1 | USDC is the native gas token; native balances use 18 decimals, the ERC-20 interface at `0x3600...0000` uses 6 decimals, and both share one balance | Contract and app use only the ERC-20 interface with 6 decimals; never read `msg.value`; never mix the two in maths (raw values differ by 10^12) | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A2 | Transactions with `maxFeePerGas` below 20 gwei are silently dropped | Set `maxFeePerGas` to at least 25 gwei and `maxPriorityFeePerGas` to 1 gwei on every write, in both the app and Foundry scripts | [EVM differences](https://docs.arc.io/arc/references/evm-differences), [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees.md) |
| A3 | `eth_estimateGas` has been reported to fail for USDC writes on Arc | Try estimation first; on failure fall back to fixed limits: approve 100,000; fund 150,000; spend and request 250,000; approve request 200,000; create 600,000 | [arc-node issue #80](https://github.com/circlefin/arc-node/issues/80) |
| A4 | Finality is deterministic and instant; one confirmation is final | Treat the first receipt as final; label it "Final" in the UI; no multi-block waits | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A5 | Block timestamps are non-decreasing, not strictly increasing, with sub-second blocks | Order the feed by block number and log index, never by timestamp; timestamps are fine for weekly periods and lock dates | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A6 | Native sends to the zero address revert; transfers to or from a blocklisted address revert and still cost gas | Validate recipients in the UI and contract; map a blocklist revert to "This payment was blocked by USDC compliance rules" | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A7 | Native USDC movements emit EIP-7708 Transfer logs from a system address, so generic indexers can double count | The feed reads only Earmark's own events, never Transfer logs | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A8 | The mainnet explorer API sits behind a Cloudflare bot challenge | All data comes from the RPC; the explorer is used only for human-facing links | [ArcGuard README](https://github.com/Aniekan-Udo/arcguard) |
| A9 | `PREVRANDAO` always returns 0 | Earmark uses no randomness | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A10 | Standard `anvil` runs a standard EVM, not Arc's | Unit tests use a 6-decimal mock USDC; behaviour is confirmed on Arc testnet before mainnet | [EVM differences](https://docs.arc.io/arc/references/evm-differences) |
| A11 | Some wallets show the USDC balance as "ETH" or with the wrong decimals | The app shows its own correct USDC figures and tells users not to rely on the wallet's display | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) |

**Activity feed algorithm (no indexer, no range scans)**

1. Read `pocket.lastEventBlock` with `getPocket(id)`.
2. Call `eth_getLogs` for that single block, filtered by the contract address and the `pocketId` topic.
3. Add the returned events to the feed; the next block to read is the smallest `prevEventBlock` among them that is lower than the current block.
4. Repeat until 30 events are loaded or the pointer reaches the creation block; a "Load older" button continues the walk.
5. For live updates, poll `eth_getLogs` from the last seen block to the latest block every 2 seconds for the contract address.

## 9. Web app architecture and tech stack

Earmark is a static single-page app that reads and writes Arc directly through the user's wallet and the public RPC, so hosting is free and there is nothing to run or pay for.

&#91;embedded content: system architecture · 6 components, no server\]

The explorer at explorer.arc.io appears only as links for people; the naira rate call is optional and the app works without it.

| Layer | Choice | Reason | Cost |
| --- | --- | --- | --- |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin Contracts 5.x | Standard, audited building blocks | Free |
| Static analysis | Slither | Catches common contract bugs before deploy | Free |
| Frontend | Vite, React, TypeScript (current stable versions) | Fast static build, no server | Free |
| Chain access | viem plus wagmi with the injected connector only | Works in MetaMask, Rabby, OKX and Bitget browsers; no WalletConnect project ID needed | Free |
| Styling | Plain CSS or Tailwind | Small bundle | Free |
| Hosting | Vercel Hobby plan (GitHub Pages as fallback) | Deploys from GitHub on every push | Free |
| Naira rate | A free no-key rate endpoint, for example open.er-api.com, cached for 1 hour | Display only | Free |
| Repo | Public GitHub repository, MIT licence | Required by the programme | Free |
| Demo video | OBS Studio or a phone screen recorder, uploaded to YouTube as unlisted | Clear walkthrough for reviewers | Free |

**Frontend modules**

- `chains.ts`: `defineChain` objects for Arc mainnet (5042) and Arc testnet (5042002), native currency USDC with 18 decimals.
- `config.ts`: reads `VITE_NETWORK`, `VITE_POCKETS_ADDRESS`, `VITE_DEPLOY_BLOCK`, `VITE_RPC_URL`.
- `lib/amounts.ts`: parse and format 6-decimal USDC with `parseUnits` and `formatUnits`; never floating-point maths for money.
- `lib/tx.ts`: one wrapper for every write that applies the fee floor (A2), the gas fallback (A3), the three UI states and error mapping (Section 7.5).
- `lib/activity.ts`: the back-pointer feed walk and the 2-second live poll (Section 8).
- `lib/rates.ts`: fetch and cache the naira rate; hide naira figures if it fails.

## 10. Non-functional requirements

Security and privacy rules are pass or fail gates for release; performance and accessibility targets are checked on a mid-range Android phone before submission.

| Area | Requirement | Check |
| --- | --- | --- |
| Security | No owner, admin, pause, upgrade, `delegatecall` or `selfdestruct` in the contract | Code review |
| Security | Checks, effects, interactions order; `nonReentrant` on every write; `SafeERC20` for every transfer | Code review and tests |
| Security | Exact-amount USDC approvals only; never unlimited | Frontend review |
| Security | Deployer key lives only in `.env`; `.env` is in `.gitignore`; a fresh wallet holds only the deploy funds | Repo check before first push |
| Security | Slither reports no high or medium findings | `slither .` output saved to `docs/SECURITY.md` |
| Security | UI banner: "Proof of concept. Use small amounts." | Visual check |
| Privacy | No names, phone numbers or other personal data on-chain; labels stay generic ("School fees", not a child's name) | Form hint and review |
| Privacy | Memo field warns that notes are public and caps them at 64 bytes | Visual check |
| Privacy | No analytics, cookies or trackers | Network tab check |
| Performance | JavaScript bundle under 300 KB gzipped | `vite build` report |
| Performance | Pocket and balance reads render in under 1 second on 4G | Manual timing |
| Performance | A confirmed spend appears on the sender's screen within 3 seconds | Two-device test |
| Reliability | RPC URL is configurable; clear error states when the RPC or rate API fails | Kill-switch test |
| Accessibility | WCAG 2.2 AA colour contrast; tap targets at least 44 px; every input labelled; status never shown by colour alone; keyboard navigation works | Lighthouse accessibility score of 90 or higher |
| Compatibility | Chrome on Android, Safari on iOS, and the in-app browsers of MetaMask, OKX and Bitget wallets | Manual test matrix |
| Language | English for the MVP; copy kept in one file so Yoruba, Hausa and Igbo can follow | Code review |

## 11. Testing and QA plan

Nothing goes to mainnet until the Foundry suite passes with at least 95% line coverage on `EarmarkPockets.sol` and the 15-step testnet rehearsal below passes end to end.

### 11.1 Contract tests (Foundry)

| Suite | What it covers |
| --- | --- |
| Unit: create | Valid pocket; each validation error; deposit credited by balance delta; payees stored; first gas top-up; events emitted |
| Unit: fund | Anyone can fund; zero amount reverts; unknown pocket reverts |
| Unit: spend | Within limit succeeds; over limit reverts with `OverLimit`; non-payee reverts when `payeeOnly`; non-spender reverts; memo length; period rollover resets the limit |
| Unit: requests | Create, approve, decline, cancel; approve with short balance reverts; double handling reverts `NotPending`; 21st pending reverts |
| Unit: withdraw and lock | Withdraw with no lock; blocked before lock date; allowed at and after lock date; `extendLock` only forwards |
| Unit: gas top-up | Tops up below half the float; respects the per-period cap and the pocket balance; no top-up when float is 0 |
| Unit: native value | Sending native value to the contract reverts |
| Fuzz | Random amounts, limits and time jumps: `spentInPeriod` never exceeds the limit; balances always reconcile |
| Invariant | A handler runs random sequences of all functions; invariants 1 to 7 from Section 7.6 hold after every call |
| Gas | `forge test --gas-report` saved to `docs/GAS.md` |

Use a 6-decimal mock USDC in local tests. Commands: `forge test -vvv`, `forge coverage`, `forge test --gas-report`, `slither .`.

### 11.2 Frontend tests

- Vitest unit tests for `lib/amounts.ts` (6-decimal parsing, no rounding errors) and `lib/activity.ts` (the back-pointer walk, including two events in one block).
- Manual device matrix from Section 10.

### 11.3 Testnet rehearsal (two wallets: Sender and Family)

- [ ] 1\. Sender switches to Arc testnet through the app prompt.
- [ ] 2\. Sender creates "Food": limit 20 USDC per 7 days, float 0.05, deposit 30 USDC.
- [ ] 3\. Family wallet receives about 0.05 USDC gas float with 0 USDC before.
- [ ] 4\. Sender creates "School fees": request-only, payee-only with one payee, lock 7 days ahead, deposit 50 USDC.
- [ ] 5\. A third wallet funds "Food" with 5 USDC; the sender sees it in the feed.
- [ ] 6\. Family pays 8 USDC from "Food" to any address; final within 1 second; sender screen updates within 3 seconds.
- [ ] 7\. Family tries 15 USDC from "Food"; the app offers "Ask for approval" instead.
- [ ] 8\. Family requests 15 USDC; sender approves; recipient receives it.
- [ ] 9\. Family requests from "School fees"; sender declines; balance unchanged.
- [ ] 10\. Sender tries to withdraw from "School fees"; the UI shows the lock date and the button is disabled.
- [ ] 11\. Sender withdraws 5 USDC from "Food".
- [ ] 12\. Public page for each pocket opens with no wallet connected.
- [ ] 13\. Feed shows every step in order, with working explorer links.
- [ ] 14\. Naira figures show; blocking the rate API hides them without breaking anything.
- [ ] 15\. Everything above repeated on a phone in a wallet's in-app browser.

## 12. Deployment runbook

Deploy to Arc testnet first, pass the rehearsal in Section 11.3, then repeat the same commands against mainnet from a clean, tagged commit.

1. **Create a fresh wallet** in MetaMask or Rabby used only for this project. Create a second account for the "Family" role in the demo.
2. **Add both Arc networks** to the wallet using the values in Section 18.
3. **Get testnet USDC** for both accounts from [faucet.circle.com](https://faucet.circle.com) (choose Arc Testnet).
4. **Get 2 to 5 mainnet USDC on Arc.** Withdraw from an exchange that lists the Arc network for USDC. At launch OKX, Kraken and Gate had Arc deposits and withdrawals open ([CoinMarketCap](https://coinmarketcap.com/academy/article/circle-arc-blockchain-usdc-gas)), and Bybit was covering Arc withdrawal fees for a limited time with a 2 USDC minimum ([Bybit](https://announcements.bybit.com/en/article/bybit-launches-usdc-on-arc-chain-zero-fees-lucky-draws-and-high-yield-staking--artb5ebbf5e2327/)). Send a tiny test amount first and select the Arc network carefully.
5. **Install tools:** Git, Node.js LTS, Foundry and Slither.

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge init contracts && cd contracts
forge install OpenZeppelin/openzeppelin-contracts
pip install slither-analyzer
```

6. **Configure Foundry** in `contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]

[rpc_endpoints]
arc_testnet = "https://rpc.testnet.arc.io"
arc_mainnet = "https://rpc.mainnet.arc.io"
```

7. **Create `contracts/.env`** (never committed) and confirm `.env` is listed in `.gitignore`:

```bash
PRIVATE_KEY=0xYOUR_FRESH_DEPLOYER_KEY
USDC=0x3600000000000000000000000000000000000000
```

8. **Deploy script** at `contracts/script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {EarmarkPockets} from "../src/EarmarkPockets.sol";

contract Deploy is Script {
    function run() external returns (EarmarkPockets pockets) {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        pockets = new EarmarkPockets(IERC20Metadata(vm.envAddress("USDC")));
        vm.stopBroadcast();
    }
}
```

9. **Sanity check and deploy to testnet:**

```bash
source .env
cast chain-id --rpc-url arc_testnet   # expect 5042002
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast --with-gas-price 25gwei --priority-gas-price 1gwei
```

10. **Record the deployment** in `deployments/arc-testnet.json`: contract address, deploy transaction hash, block number, Git commit.
11. **Point the web app at testnet** in `web/.env.local`: `VITE_NETWORK=arcTestnet`, `VITE_POCKETS_ADDRESS`, `VITE_DEPLOY_BLOCK`, `VITE_RPC_URL`. Run `npm run dev` and complete the rehearsal.
12. **Tag the release:** `git tag v0.1.0 && git push --tags`.
13. **Deploy to mainnet** with the same script:

```bash
cast chain-id --rpc-url arc_mainnet   # expect 5042
forge script script/Deploy.s.sol:Deploy --rpc-url arc_mainnet --broadcast --with-gas-price 25gwei --priority-gas-price 1gwei
```

14. **Record** `deployments/arc-mainnet.json` and confirm the contract on [explorer.arc.io](https://explorer.arc.io).
15. **Source verification:** if the explorer offers a verification form, submit the standard JSON input from `forge verify-contract --show-standard-json-input <address> src/EarmarkPockets.sol:EarmarkPockets`. If it does not, commit that JSON and the compiler settings so anyone can rebuild the bytecode, and say so in the README.
16. **Host the app:** in Vercel, import the GitHub repo, set the root directory to `web`, framework Vite, add the mainnet environment variables, deploy. Because routes use `/#/`, no rewrite rules are needed.
17. **Create the demo pockets on mainnet** (use small amounts, for example 1 to 2 USDC in total) and run steps 2 to 11 of the rehearsal. Save every transaction hash for the README.

**Expected cost:** Arc targets about $0.001 per ERC-20 transfer ([Gas and fees](https://docs.arc.io/arc/references/gas-and-fees.md)), so deployment plus about 30 demo transactions should stay under 0.25 USDC. The demo deposits can be withdrawn afterwards.

## 13. Repository structure and documentation

One public monorepo holds the contract, the web app and the evidence reviewers need, with the README as the front door.

```text
earmark/
  README.md
  LICENSE                      MIT
  .gitignore                   includes .env, .env.local, out/, cache/, node_modules/
  contracts/
    foundry.toml
    .env.example               PRIVATE_KEY and USDC placeholders only
    src/EarmarkPockets.sol
    test/EarmarkPockets.t.sol
    test/EarmarkPockets.fuzz.t.sol
    test/invariant/Handler.sol
    test/invariant/Invariants.t.sol
    test/mocks/MockUSDC.sol     6 decimals
    script/Deploy.s.sol
  web/
    index.html
    vite.config.ts
    .env.example
    src/chains.ts
    src/config.ts
    src/abi.ts
    src/lib/amounts.ts
    src/lib/tx.ts
    src/lib/activity.ts
    src/lib/rates.ts
    src/lib/errors.ts           error to message map from Section 7.5
    src/pages/Landing.tsx
    src/pages/SenderDashboard.tsx
    src/pages/NewPocket.tsx
    src/pages/PocketDetail.tsx
    src/pages/FamilyHome.tsx
    src/pages/PublicPocket.tsx
    src/components/PayOrAskSheet.tsx
    src/copy.ts                 all user-facing text in one place
  deployments/
    arc-testnet.json
    arc-mainnet.json
  docs/
    FRICTION-LOG.md
    SECURITY.md
    GAS.md
    SUBMISSION.md
    DEMO-SCRIPT.md
```

**README must contain, in this order**

1. Name, one-liner and a screenshot or GIF.
2. Live app link, mainnet contract address with explorer link, and links to three demo pockets.
3. The problem in three sentences, with the J-PAL finding.
4. How Earmark uses Arc: the four points from Section 14.
5. How it works: the flow diagram and the rules.
6. Run it yourself: prerequisites, `forge test`, `npm run dev`, environment variables.
7. Security notes and known limitations from Section 7.
8. Roadmap from Section 17.
9. References (APA 7th) and licence.

**`docs/FRICTION-LOG.md`** records every Arc-specific snag hit during the build (fee floor, gas estimation, decimals, explorer access), each with date, symptom, cause and fix. Circle's developer team values this feedback, and it shows reviewers real work on Arc.

## 14. Submission package

The DoraHacks entry needs a live mainnet link, a public repo, a short description of what the project does and what it uses Arc for, and a public builder profile ([Arc Microgrants](https://dorahacks.io/hackathon/arc-microgrants)); everything below is ready to paste.

**Name:** Earmark

**One-liner:** Purpose-bound USDC pockets for money sent home, settled on Arc.

**Description:**

> Families abroad send billions home every year, and once the money lands the sender loses all say in how it is used. Earmark lets a sender fund labelled pockets on Arc, such as school fees, food, rent and emergencies, and set simple rules: a weekly allowance, approved payees, requests above the limit, and an optional commitment lock the sender cannot reverse before a chosen date. Relatives in other countries can fund the same pocket. Every spend settles in under a second and appears on the sender's dashboard straight away.
>
> The design follows field evidence. In a J-PAL study, simply letting migrants label remittances for education raised the amount they sent by more than 15 percent. Earmark turns that label into a rule enforced by software, following the Purpose Bound Money model published by the Monetary Authority of Singapore, applied to households on open rails.

**How Earmark uses Arc:**

- Pockets hold USDC through Arc's ERC-20 interface, so no second token is involved anywhere.
- Each pocket tops up the family member's gas from the same USDC, so a first-time user never has to buy a gas token.
- Deterministic finality means a spend is final by the time the sender sees it.
- Dollar-denominated fees of about a tenth of a cent keep small, everyday allowances economical.

**Links:** live app, GitHub repo, contract on explorer.arc.io, three demo pocket pages, demo video, builder profile (GitHub or X; submitting pseudonymously is allowed).

### 14.1 Demo video script (90 seconds)

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00 to 0:10 | Landing page | "Nigerians abroad sent home about 21.8 billion dollars last year. Once it lands, they lose all say in how it is used." |
| 0:10 to 0:30 | Sender creates "Food" (20 USDC a week) and "School fees" (locked to end of term) | "On Earmark I fund pockets with a purpose and set the rules. School fees is locked, so even I cannot pull it back early." |
| 0:30 to 0:50 | Phone: family view, pays a trader 5 USDC from Food; laptop feed updates | "My mother pays straight from Food. It is final in under a second, and I see it immediately." |
| 0:50 to 1:05 | Family asks for textbooks from School fees; sender approves | "Bigger or unplanned costs become a request. One tap and the payee is paid." |
| 1:05 to 1:15 | Family wallet balance, gas top-up in feed | "She never bought a gas token. On Arc, gas is USDC, so the pocket keeps her topped up." |
| 1:15 to 1:30 | Explorer page, repo, closing card | "Live on Arc mainnet, open source. Earmark: money sent home, with a purpose." |

### 14.2 Final checklist before pressing Submit

- [ ] Contract deployed and working on Arc mainnet (testnet-only builds are ineligible).
- [ ] Live app opens on a phone and a laptop with no errors.
- [ ] At least three demo pockets with real transactions of every type.
- [ ] Public repo with README, licence, tests, deployments and docs folder.
- [ ] No private key or `.env` file anywhere in Git history.
- [ ] Description names what Earmark does and what it uses Arc for.
- [ ] Builder profile public (GitHub, X or Farcaster).
- [ ] Payout wallet can receive USDC on Arc.
- [ ] One submission for this project only.
- [ ] Submitted by Sunday 4 October; hard deadline 14 October, 23:59 ET (04:59 on 15 October in Lagos).

## 15. Milestones and timeline

Submit on Sunday 4 October; reviews are rolling, so an early, solid entry is decided sooner, and the ten days before the deadline stay free for fixes.

&#91;embedded content: build timeline · 28 Sep to 21 Oct 2026\]

The dashed line marks submission day; everything after it is slack, not planned work.

**Exit criteria for each milestone**

- [ ] **Setup and funding (28 to 29 Sep):** fresh wallets, both Arc networks added, testnet USDC in both accounts, 2 to 5 mainnet USDC on Arc, public GitHub and X profiles, name checked.
- [ ] **Contract and tests (29 Sep to 1 Oct):** `EarmarkPockets.sol` complete; unit, fuzz and invariant tests pass; coverage at least 95%; Slither clean.
- [ ] **Testnet deploy (1 Oct):** contract live on 5042002; address recorded in `deployments/arc-testnet.json`.
- [ ] **Web app (1 to 3 Oct):** all seven screens working against testnet; the 15-step rehearsal passes on laptop and phone.
- [ ] **Mainnet and demo (3 Oct):** contract live on 5042; app live on Vercel; three demo pockets with every transaction type; hashes in the README.
- [ ] **Submit (4 Oct):** README, friction log, demo video uploaded, DoraHacks form complete and submitted.

## 16. Risks, mitigations and reviewer Q&A

The biggest risk is not being selected, since only 20 grants exist; the plan counters it with an early, complete, well-evidenced entry rather than more features.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Not selected among many strong entries | High | High | Submit by 4 Oct; evidence-backed story; Arc-only features; tests and friction log; clean demo video |
| Someone ships a similar family-pocket app first | Medium | Medium | Ship fast; the diaspora angle, J-PAL evidence and PBM framing stay distinctive |
| Cannot get USDC onto Arc mainnet in time | Low | High | Try several exchanges on Day 1; bridging through Circle CCTP is the fallback |
| Gas estimation or fee-floor failures in wallets | Medium | Medium | Requirements A2 and A3; test in three wallets |
| Contract bug after mainnet deploy | Low | High | Immutable contract, so keep demo amounts small; full test suite and Slither before deploy; redeploy a fixed version if needed and update the README |
| Private key leaked through GitHub | Low | High | Fresh wallet holding only a few USDC; `.gitignore` checked before the first push |
| Scope creep delays submission | Medium | High | P1 items only after P0 passes the rehearsal |
| Free rate API down | Medium | Low | Naira figures hide gracefully |

**Questions reviewers may ask**

1. **Who accepts USDC in Nigeria today?** A payee can be any wallet, including an exchange deposit address for cash-out. The J-PAL evidence shows the label does most of the work, and payee-only pockets are an optional hard lock for schools or landlords that accept USDC.
2. **Isn't this just a multisig allowance?** A multisig controls who signs. Earmark controls what money is for, who may add to it, when it may be reclaimed, and it keeps the spender's gas topped up from the same USDC.
3. **What about regulation?** The proof of concept is non-custodial software: no builder custody, no fees and no fiat handling. Any production service would take legal advice in each market; this is not legal advice.
4. **What about privacy?** Only addresses, amounts and short generic labels go on-chain. Arc's opt-in privacy with view keys, now in development ([Circle](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)), is the upgrade path.
5. **Why Arc and not another chain?** Gas in USDC makes the self-fuelling pocket possible, deterministic finality makes the live feed trustworthy, and Circle's own roadmap (App Kits, wallets, privacy) is the path to production.

## 17. Success metrics and roadmap

For the grant, success is a complete mainnet submission by 4 October; after the grant, success is a real household pilot that tests whether labelled pockets increase what senders send.

| Stage | Metric | Target |
| --- | --- | --- |
| Submission | Goals G1 to G5 in Section 1 met | All five by 4 Oct |
| Submission | Real mainnet transactions across all types | At least 10 |
| Submission | Contract test coverage | At least 95% of lines |
| Pilot | Sender and family pairs using Earmark | 10 to 20 pairs |
| Pilot | Share of payments made within rules (no request needed) | Tracked monthly |
| Pilot | Change in monthly amount sent versus each sender's prior 3 months | Tracked; compared with the 15% J-PAL result |
| Pilot | Sender trust score in a short survey (1 to 5) | 4 or higher |

**Roadmap after the microgrant**

1. **Easier onboarding:** passkey wallets for family members (as in Circle's Arc P2P sample app), SMS or WhatsApp alerts for senders, request expiry. Gate: 5 families using it without help.
2. **Easier funding:** App Kit onramp so senders can fund with a card, and EURC or GBP-denominated senders through App Kit swaps. Gate: first cross-currency funding completed.
3. **Real payees:** a registry of schools, landlords and traders that accept USDC or work with a local off-ramp partner. Gate: 3 institutions registered.
4. **Privacy and agents:** adopt Arc's opt-in privacy when it ships; allow an AI bill-pay agent as a spender under the same caps. Gate: privacy feature live on Arc.
5. **Funding:** apply to the Circle Grant Program with pilot data once stage 3 is reached.

## 18. Appendix

### 18.1 Arc network constants

Values from the Arc documentation as of 27 September 2026 ([Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [EVM differences](https://docs.arc.io/arc/references/evm-differences)); confirm with `cast chain-id` before each deploy.

| Item | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 5042 (0x13B2) | 5042002 (0x4CEF52) |
| RPC | https://rpc.mainnet.arc.io | https://rpc.testnet.arc.io |
| Explorer | https://explorer.arc.io | https://explorer.testnet.arc.io |
| Native currency | USDC, 18 decimals | USDC, 18 decimals |
| USDC ERC-20 interface | 0x3600000000000000000000000000000000000000 (6 decimals) | Same address |
| Minimum `maxFeePerGas` | 20 gwei | 20 gwei |
| Faucet | None (real USDC) | https://faucet.circle.com |

### 18.2 Glossary

| Term | Meaning in Earmark |
| --- | --- |
| Pocket | A labelled balance of USDC with its own rules |
| Sponsor | The sender who created the pocket and controls its rules |
| Spender | The family member allowed to pay from the pocket |
| Payee-only | A setting that limits spending to approved recipients |
| Commitment lock | A date before which the sponsor cannot withdraw |
| Gas float | A few cents of USDC the pocket keeps in the spender's wallet for fees |
| Period | The window (default 7 days) in which the spending limit applies |
| Deterministic finality | A transaction is final as soon as it is in a block |
| Purpose Bound Money (PBM) | MAS's model of wrapping money with purpose rules without changing the money itself |

### 18.3 References

Abdul Latif Jameel Poverty Action Lab. (n.d.). *Testing commitment devices for remittances among Filipino migrants in Rome*. Retrieved September 27, 2026, from https://www.povertyactionlab.org/evaluation/testing-commitment-devices-remittances-among-filipino-migrants-rome

Aniekan-Udo. (n.d.). *ArcGuard* \[Computer software\]. GitHub. https://github.com/Aniekan-Udo/arcguard

Arc Network Services LLC. (n.d.-a). *Connect to Arc*. Arc Docs. Retrieved September 27, 2026, from https://docs.arc.io/arc/references/connect-to-arc

Arc Network Services LLC. (n.d.-b). *EVM differences*. Arc Docs. Retrieved September 27, 2026, from https://docs.arc.io/arc/references/evm-differences

Arc Network Services LLC. (n.d.-c). *Gas and fees*. Arc Docs. Retrieved September 27, 2026, from https://docs.arc.io/arc/references/gas-and-fees

Bybit. (2026, September 17). *Bybit launches USDC on Arc Chain: Zero fees, lucky draws, and high-yield staking*. https://announcements.bybit.com/en/article/bybit-launches-usdc-on-arc-chain-zero-fees-lucky-draws-and-high-yield-staking--artb5ebbf5e2327/

Circle Internet Group. (2026, September 16). *Circle launches Arc mainnet, an economic operating system for the internet* \[Press release\]. https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet

circlefin. (n.d.). *\[Issue #80 on eth\_estimateGas failures for USDC write transactions\]* \[GitHub issue\]. GitHub. https://github.com/circlefin/arc-node/issues/80

CoinMarketCap Academy. (2026). *What is Circle's Arc? The blockchain that charges gas in USDC*. https://coinmarketcap.com/academy/article/circle-arc-blockchain-usdc-gas

De Arcangelis, G., Joxhe, M., McKenzie, D., Tiongson, E., & Yang, D. (2015). Directing remittances to education with soft and hard commitments: Evidence from a lab-in-the-field experiment and new product take-up among Filipino migrants in Rome. *Journal of Economic Behavior & Organization, 111*, 197-208. https://doi.org/10.1016/j.jebo.2014.12.025

DoraHacks. (2026). *Arc Microgrants*. https://dorahacks.io/hackathon/arc-microgrants

Monetary Authority of Singapore. (2023). *Purpose bound money (PBM) technical whitepaper*. https://www.mas.gov.sg/-/media/mas-media-library/development/fintech/pbm/pbm-technical-whitepaper.pdf

Team Arc. (2026, September 16). *The unfinished business of finance, machine commerce, and global money: A request for builders*. Arc. https://www.arc.io/blog/the-unfinished-business-of-finance-machine-commerce-and-global-money

United Nations Department of Economic and Social Affairs. (2025). *World economic situation and prospects: November 2025 briefing, no. 196*. https://policy.desa.un.org/publications/world-economic-situation-and-prospects-november-2025-briefing-no-196

Vanguard. (2026, May). *Diaspora remittances stabilises at $21.8bn in 2025 amid global pressures*. https://www.vanguardngr.com/2026/05/diaspora-remittances-stabilises-at-21-8bn-in-2025-amid-global-pressures/
