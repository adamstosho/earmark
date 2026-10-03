# Handoff: where Earmark stands (29 Sep 2026)

For whoever continues this work (a person, Cursor or another assistant). Read `AGENTS.md` first: it holds the standing rules. This page is the current state and the next steps.

## Goal and dates

- Earmark: purpose-bound USDC pockets for money sent home, on Arc. One immutable Solidity contract plus one static React app.
- **Contract on Arc mainnet and app on Vercel by Saturday 3 October 2026.**
- **Arc Microgrants submission on DoraHacks by Sunday 4 October 2026.** The hard deadline is 14 October, 23:59 ET.
- Sources of truth, in order:
  1. `docs/DECISIONS.md` (D1–D13, C1–C55);
  2. `docs/PRD.md`;
  3. `design-system/`.

## Done and verified

| Area | State | Evidence |
| --- | --- | --- |
| Contract `contracts/src/EarmarkPockets.sol` | PRD Section 7 with D2, D3, D5. Includes the owner-approved P1 functions `setPayee`, `setLimit` and `cancelRequest` (C1). `fund` now rolls the period and tops up the family member (C56, approved 30 Sep 2026). | `forge test`: 104 passed. `forge coverage`: 100% lines, statements, branches and functions. `slither .`: 0 high, 0 medium, 5 low (timestamps, reviewed). `forge lint`: 0. |
| Gas | Worst cases measured; D7 fallbacks set in `web/src/lib/gas.ts` | `docs/GAS.md` |
| Web app `web/` | Every P0 screen on the design system, light and dark | Type check, ESLint (strict), Vitest 71/71; 218 KB gzipped; Lighthouse accessibility 100; axe WCAG 2.2 AA: 0 violations |
| Local rehearsal | PRD 11.3 steps 1–14 against anvil configured like Arc | `node web/e2e/rehearsal.mjs`: 16/16, 0 console errors |
| Wallet choice | EIP-6963: lists installed wallets when there are several (C55); fixed the owner's "You cancelled in your wallet" error | `node web/e2e/multi-wallet.mjs` passes |
| Arc testnet deploy | Done by the owner | See below |
| Docs | README, DEPLOY, REHEARSAL, SECURITY, GAS, FRICTION-LOG, SUBMISSION, DEMO-SCRIPT, DECISIONS, PROGRESS | `docs/` |

Branch `main`. The C56 fee-credit fix is in the working tree and is **not committed yet**. Nothing has been pushed to GitHub.

## Arc testnet deployment

- **Contract:** `0x68C480758172bBC94858B98F6E5E356FA30e3080`, block 64978753, deployed 1 Oct 2026 from the uncommitted C56 working tree (parent `9115799`). Replaces the 29 Sep contract `0x86704058f4D5374653f21C6Ad6eBdC6BCCB218e4`. Bytecode matches this build apart from the USDC immutable. Details are in `deployments/arc-testnet.json`.
- **App settings:** `web/.env.local` (git-ignored) and `web/.env.example` point at it with `VITE_RPC_URL=https://rpc.testnet.arc.io`.

## The owner's wallets (public addresses)

| Role | Address |
| --- | --- |
| Deployer (Foundry keystore `earmark-deployer`) | `0x1a98d7b853075Fed1Fe7644D2c36E4168E8bfbCE` |
| Sender | `0x7689d4cFA7f26E26D56dD86f9E9A935Be62c84D1` |
| Family ("Mama") | `0x1dAaf2C7B71b82084ED8549A1De246f712203503` |
| Co-funder | `0xbaA35499e53C1AC3b627BDDeb2796D1B845e32C5` |

Never ask for or handle a private key. The owner runs every command that sends a transaction. **On Windows, type keystore passwords in PowerShell, not Git Bash**, because Git Bash garbled the password once.

## Where we stopped: testnet rehearsal

The owner approved C56 on 30 Sep 2026 and redeployed on 1 Oct 2026. `fund` rolls the period, then tops up the family member with the same half-float rule and the same per-period cap as `spend` and `request`. The `fund` fallback is 175,000.

Checked on 30 Sep 2026: `forge test` 104 passed; coverage 100% lines, statements, branches and functions; Slither 0 high, 0 medium, 5 low (timestamps); `forge lint` 0. Web: ABI unchanged, type check and ESLint clean, Vitest 71/71. Local rehearsal on 1 Oct 2026: 16/16, 0 console errors.

The owner now follows `docs/REHEARSAL.md` steps 1–14 with the Sender, Family and Co-funder accounts. Create "Food" with the money box empty, add money afterwards, and confirm Mama receives fee credit before she spends. Report any failure (step, message, screenshot). Restart the app first so it loads the new address.

## Next steps after that

1. **Testnet rehearsal on the laptop:** the owner follows `docs/REHEARSAL.md` steps 1–14 with the Sender, Family and Co-funder accounts, and reports any failure (step, message, screenshot).
2. **GitHub:**
   - The owner creates an empty **public** repository named `earmark`.
   - Decided: commits use the GitHub noreply address `adamstosho@users.noreply.github.com`. The remote is `https://github.com/adamstosho/earmark.git`.
   - Give the owner the push commands.
3. **Vercel:** import the repository; root directory `web`; framework Vite; set the environment variables. Use testnet first, so the owner can do rehearsal step 15 on a phone in a wallet's in-app browser.
4. **Mainnet USDC:** the owner gets 2–5 real USDC onto Arc mainnet in the Deployer wallet (OKX, Kraken, Gate or Bybit; send a tiny test amount first).
5. **Mainnet launch** (`docs/DEPLOY.md` sections 4–6):
   1. Tag `v0.1.0`.
   2. Deploy with the D6 fees, then write `deployments/arc-mainnet.json`.
   3. Verify the source on Sourcify and commit the standard JSON input.
   4. Set the Vercel variables to mainnet.
   5. Create three small demo pockets covering every transaction type, and set `VITE_DEMO_POCKET_ID`.
   6. Fill the README link slots and replace its local screenshots.
6. **Submission:**
   1. Record the 90-second video (`docs/DEMO-SCRIPT.md`).
   2. Paste `docs/SUBMISSION.md` into DoraHacks.
   3. Go through its final checklist.

## Commands

```bash
# Contracts (in contracts/; Foundry is at ~/.foundry/bin)
forge build
forge test
forge coverage --report summary --no-match-coverage "(test|script)/"
forge test --gas-report
forge test --match-contract GasWorstCase -vv
slither .            # Slither is at ~/AppData/Roaming/Python/Python314/Scripts

# Web (in web/)
npm run dev          # http://localhost:5173
npx tsc -b && npx eslint . && npx vitest run && npx vite build
npm run abi          # after any contract change: regenerates web/src/abi.ts

# Local end-to-end (in web/)
bash e2e/fresh-chain.sh     # restarts anvil like Arc testnet and redeploys; overwrites web/.env.local
node e2e/rehearsal.mjs      # needs `npx vite --port 5173` running
node e2e/testnet-smoke.mjs  # read-only check against Arc testnet (web/.env.local must point at testnet)
node e2e/multi-wallet.mjs   # two-wallet connection check
```

**Warning:** `e2e/fresh-chain.sh` overwrites `web/.env.local` with the local-chain settings. Put the testnet values back afterwards; they are in `web/.env.example`.
