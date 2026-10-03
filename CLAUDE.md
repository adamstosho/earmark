# Earmark: standing rules for every session

Earmark is purpose-bound USDC pockets on Arc: one immutable Solidity contract (`contracts/`) and one static, mobile-first React app (`web/`). This file and `AGENTS.md` are identical; change both together.

## Sources of truth (read before changing anything)

1. `docs/DECISIONS.md`: decisions D1 to D13 and every logged conflict. These override everything below.
2. `docs/PRD.md`: behaviour (contract spec Section 7, Arc requirements Section 8, tests Section 11, deploy Section 12, layout Section 13).
3. `design-system/`: everything the user sees (README, `guidelines/10` to `50`, `components/index.d.ts`, component READMEs, `tokens.json`).

Precedence: DECISIONS, then PRD for behaviour, then the design system for layout, components, colour, type and every word of copy.

## Scope

- P0 only (PRD Section 4). No P1 item until the testnet rehearsal passes and the product owner approves it. Exception approved on 29 Sep 2026 (DECISIONS C1): the contract includes `setPayee`, `setLimit` and `cancelRequest`; their screens still wait for approval.
- No backend, database, analytics, cookies, trackers or paid services.
- Work in phases (see `docs/PROGRESS.md`). Stop at the end of each phase with the checkpoint report.

## Security (non-negotiable)

- Never ask for, read, print, log or store a private key or seed phrase. The product owner runs every command that broadcasts.
- Run `git status` before every commit. `.env`, `.env.*` (except `.env.example`), `out/`, `cache/`, `broadcast/`, `node_modules/` and `notes/` are never committed.
- Contract: no owner, admin, pause, upgrade, `delegatecall`, `selfdestruct`, `payable` or `receive()`. Every write is `nonReentrant`, follows checks-effects-interactions, and moves USDC only through `SafeERC20`.
- USDC approvals are for the exact amount only, never unlimited. Skip approval only when the current allowance already covers the exact amount.

## Decisions in short (full text in docs/DECISIONS.md)

- D1 Words: never "gas", "transaction", "hash", "mainnet", "sponsor", "spender" in the UI. Use the word list in `design-system/guidelines/10-content.md`. Fee top-ups show as "Fee credit added". Design-system error wording wins over the PRD's.
- D2 `approveRequest(uint256)` and `declineRequest(uint256)`; events stay `Approved` and `Declined`.
- D3 `uint8 icon` (< 10) and `uint8 hue` (< 6) on `Pocket` and `CreateParams`, in `PocketCreated`; revert `BadAppearance()`. Icons: graduation-cap, bowl-food, house-line, first-aid-kit, lightning, device-mobile, bus, shopping-bag, hand-heart, piggy-bank. Hues: palm, sky, clay, teal, plum, olive.
- D4 Nicknames live only in `localStorage`, never on-chain. Show a nickname, else `shortAddress`.
- D5 `available(id)` = min(limit - spent after a virtual period roll, balance); 0 for request-only pockets.
- D6 Every write: `maxPriorityFeePerGas` 1 gwei; `maxFeePerGas` = max(25 gwei, 2 x latest base fee + 1 gwei). App and Foundry alike.
- D7 Estimate gas + 20%; on failure use fixed fallbacks (measured worst case + 30%, never below the PRD floors).
- D8 Plain CSS with design-system tokens, `.ek-type-*` and `ek-` classes only. No Tailwind, no other UI kit or icon set, no hard-coded colours or font sizes.
- D9 Hash routes: `/#/`, `/#/send`, `/#/requests`, `/#/activity`, `/#/new`, `/#/p/:id`, `/#/family`, `/#/family/activity`, `/#/view/:id`, `/#/settings`.
- D10 Sender nav: Pockets, Requests (pending count), Activity, Settings. Family nav: Home, Activity, Settings. Spend-only wallets land on `/#/family`, others on `/#/send`.
- D11 Family link `<origin>/#/family`; public link `<origin>/#/view/:id`. Co-funders are warned that the creator can take their money back.
- D12 No injected wallet on a phone: one line on opening Earmark in the MetaMask, OKX or Bitget in-app browser, plus "Copy link".
- D13 USDC stays `bigint` (6 decimals) until the component boundary; `formatUnits(value, 6)` only for display. Never read the 18-decimal native balance.

## Arc facts verified on 28 Sep 2026 (see docs/FRICTION-LOG.md)

- Mainnet 5042, testnet 5042002. Public RPCs `https://rpc.mainnet.arc.io` and `https://rpc.testnet.arc.io` accept anonymous, cross-origin requests.
- USDC ERC-20 at `0x3600000000000000000000000000000000000000`, `decimals()` = 6 on both networks.
- Base fee sits at the 20 gwei floor; below that a transaction is silently dropped.
- `eth_getLogs` rejects spans of 10,000 blocks or more (`-32012`). Chunk every range scan to 2,000 blocks.
- Load-balanced RPC backends can lag: treat `-32014 requested data not available` as retryable.
- `eth_estimateGas` can fail for USDC writes (arc-node #80, open): always keep fallbacks.
- Blockscout verification is behind Cloudflare; Sourcify is the working path.

## Quality bar

- TypeScript `strict`. No `any` in app code (the copied `web/src/ds/` may keep its own).
- No console errors or warnings. No placeholder text, lorem ipsum, TODOs, emoji or fake data in shipped screens; demo data lives only in tests.
- JavaScript bundle under 300 KB gzipped. Lighthouse accessibility 90 or more.
- Use current stable library versions and check APIs against the installed types, not memory (wagmi and viem change between majors).
- Never claim a test, build or check passed unless it ran in this session, with the key output shown. Never invent addresses, hashes, figures or API behaviour.

## Key commands

```bash
# Contracts (run inside contracts/)
forge build
forge test -vvv
forge coverage --report summary
forge test --gas-report
slither .

# Web (run inside web/)
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Deploys are run by the product owner only, with the D6 fee settings. The commands are in `docs/PRD.md` Section 12 and each phase's report.

## Layout

```text
CLAUDE.md, AGENTS.md          standing rules (identical)
LICENSE                       MIT
contracts/                    Foundry project
  src/EarmarkPockets.sol
  test/                       unit, fuzz, invariant/ (Handler, Invariants), mocks/MockUSDC.sol
  script/Deploy.s.sol
web/                          Vite + React + TypeScript
  src/chains.ts config.ts abi.ts copy.ts
  src/lib/                    amounts, tx, errors, activity, rates
  src/ds/                     copied design-system source (do not edit beyond the import header)
  src/styles/                 tokens.css, earmark.css (copied), app.css (tokens only)
  src/pages/, src/components/
deployments/                  arc-testnet.json, arc-mainnet.json
docs/                         PRD, PROGRESS, DECISIONS, FRICTION-LOG, SECURITY, GAS, SUBMISSION, DEMO-SCRIPT, REHEARSAL
design-system/                the Earmark design system (source; not shipped as-is)
notes/                        private working notes, git-ignored
```
