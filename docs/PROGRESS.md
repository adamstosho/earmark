# Progress

Target: contract on Arc mainnet (5042) and app on Vercel by Saturday 3 October 2026; DoraHacks submission by Sunday 4 October 2026. Each phase ends with a checkpoint report and waits for the product owner.

## Phase 0: Set up and plan (28 Sep)

- [x] Read every source: PRD, design-system README, GETTING-STARTED, guidelines 10 to 50, `components/index.d.ts`, every component README, `tokens.json`, the four Screens previews and the component source.
- [x] Checked the Arc facts live on both networks (chain IDs, USDC decimals, CORS, base fee, `eth_getLogs` cap, gas estimation) and read arc-node issues #80, #425 and #454.
- [x] Checked the naira rate endpoint (CORS, NGN present, daily updates, attribution terms).
- [x] Repository layout from PRD Section 13; `docs/PRD.md` and `design-system/` in place; private notes moved to git-ignored `notes/`.
- [x] `LICENSE` (MIT), `.gitignore`, `.gitattributes`, `CLAUDE.md` and `AGENTS.md` (identical).
- [x] `docs/PROGRESS.md`, `docs/DECISIONS.md` (D1 to D13 plus C1 to C31), `docs/FRICTION-LOG.md`.
- [x] `git init` and first commit, with `git status` checked and no secrets.
- [ ] Product owner answers the open decisions (C1, C30).

## Phase 1: Contract and tests

- [x] Foundry 1.8.3 (`foundryup` in Git Bash) and Slither 0.11.6 installed.
- [x] `contracts/foundry.toml` (0.8.28, optimizer 200, cancun); `forge-std` v1.16.2 and OpenZeppelin v5.7.0 as submodules.
- [x] `src/EarmarkPockets.sol` per PRD Section 7 with D2, D3, D5 and C2 to C10; NatSpec on every external function.
- [x] Mocks: 6-decimal USDC, fee-taking, no-op, blocklisting, 18-decimal and re-entering tokens.
- [x] Unit suites: constructor, create, fund, spend, requests, withdraw and lock, refuel, native value, reentrancy, event back-pointers (two events in one block), views.
- [x] Fuzz suite: limits per period, balance reconciliation, `available`, lock window, lock monotonicity, refuel formula.
- [x] Invariant handler and all seven invariants (256 runs x 100 calls).
- [x] `forge test`: 88 passed. `forge coverage`: 100% lines, statements, branches and functions on `EarmarkPockets.sol`.
- [x] `docs/GAS.md`; worst-case measurements; fallback limits set per D7 (C37).
- [x] `docs/SECURITY.md`: Slither 0 high, 0 medium, 5 low (timestamps), with the triage of three false positives.
- [x] Owner approved C1 (29 Sep): `setPayee`, `setLimit`, `cancelRequest` added with 12 unit tests and invariant coverage; 100 tests pass, 100% line and branch coverage, Slither 0 high and 0 medium.
- [x] Owner approved C56 (30 Sep): `fund` rolls the period and tops up the family member. 104 tests pass, coverage still 100%, Slither still 0 high and 0 medium.

## Phase 2: Testnet deployment (owner runs the commands)

- [x] `script/Deploy.s.sol` (refuses non-Arc chains and any USDC but `0x3600…0000`), `contracts/.env.example`.
- [x] ABI export (`contracts/script/export-abi.mjs`, `npm run abi` in `web/`) to `web/src/abi.ts` as a `const`.
- [x] Owner deployed to Arc testnet on 29 Sep 2026: `0x86704058f4D5374653f21C6Ad6eBdC6BCCB218e4`, block 64652106, fee 0.0644 USDC; bytecode identical to commit 07fdcaa (except the USDC immutable). Replaced on 1 Oct 2026 by `0x68C480758172bBC94858B98F6E5E356FA30e3080`, block 64978753, fee 0.064522437 USDC. Bytecode matches the C56 working tree except the USDC immutable.
- [x] `deployments/arc-testnet.json` and `web/.env.example` written; read-only smoke test of five screens against Arc testnet passes with 0 console errors (`web/e2e/testnet-smoke.mjs`).

## Phase 3: Web app foundation

- [x] Vite 8, React 19, TypeScript 6.0.3 strict, ESLint (strict type-checked), Vitest.
- [x] Design system copied per `50-implementation.md`; only the three import lines of `index.tsx` changed; typed facade `src/ds/typed.ts`.
- [x] `index.html` from the guide, PWA manifest, icons (192, 512, SVG, 180 apple-touch).
- [x] `chains.ts`, `config.ts` with the error screen, wagmi (injected only) and TanStack Query.
- [x] `lib/amounts.ts`, `lib/tx.ts`, `lib/errors.ts`, `lib/activity.ts`, `lib/rates.ts`, `copy.ts`, plus gas, rpc, dates, names, theme, router.
- [x] Vitest: 71 tests (amounts, activity walk and poll, every contract error, copy word list, rates, fees, dates, config).

## Phase 4: Screens

- [x] Landing, Sender dashboard, Requests, Activity, New pocket, Pocket page, Family home, Family activity, Pay and Ask, Public pocket, Settings, Not found, Config error.
- [x] Loading, empty and error states; wrong network, Arc unreachable, no naira rate; proof-of-concept notice.
- [x] Local end-to-end rehearsal of PRD 11.3 steps 1 to 14 in headless Chrome: 16 of 16 checks, 0 console errors or warnings.
- [x] Screenshots at 390 and 1280 px, light and dark, compared with the Screens previews.
- [ ] Remaining widths (360, 412, 768, 1024, 1440) and keyboard walkthrough.

## Phase 5: Quality pass and rehearsal

- [x] Type check, lint (0 problems), Vitest (71), `vite build`: 217 KB gzipped JavaScript.
- [x] Lighthouse accessibility 100 and best practices 100 on landing and public pocket; axe-core WCAG 2.2 AA: 0 violations on dashboard, pocket, new pocket, family home, pay and settings at 390 and 1280 px in both themes.
- [x] Network check: only the app itself, the Arc RPC and `open.er-api.com`; no cookies.
- [x] Kill switches: unreachable RPC shows "Could not reach Arc" with Try again and no crash; blocked rate API hides every naira figure.
- [x] `docs/REHEARSAL.md` from PRD Section 11.3.
- [ ] Owner runs the rehearsal on Arc testnet, laptop and phone; every issue fixed.

## Phase 6: Documentation

- [x] `README.md` in the PRD Section 13 order, with slots for mainnet links.
- [x] `docs/SECURITY.md`, `docs/GAS.md`, `docs/FRICTION-LOG.md`, `docs/DEPLOY.md`, `docs/SUBMISSION.md`, `docs/DEMO-SCRIPT.md`.
- [ ] Replace local screenshots and fill the slots once mainnet is live.

## Phase 7: Mainnet and hosting (owner runs the commands)

- [ ] Tag `v0.1.0`; chain ID check (5042); deploy with D6.
- [ ] `deployments/arc-mainnet.json`; Vercel settings; source verification.
- [ ] Three demo pockets; README filled with live links and receipts; PRD Section 14.2 checklist.
