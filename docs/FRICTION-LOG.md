# Arc friction log

Every Arc-specific snag hit while building Earmark: date, symptom, cause and fix. Entries are measured, not recalled; the command or source is given for each.

## 2026-09-28: `eth_getLogs` rejects wide block ranges

- **Symptom:** `eth_getLogs` from block 1 to `latest` returns `{"code":-32012,"message":"requested range too large"}` on both `rpc.mainnet.arc.io` and `rpc.testnet.arc.io`. A 5,000-block span succeeds; a 10,000-block span fails.
- **Cause:** the public RPC caps log queries below 10,000 blocks (also reported in arc-node issue #454). At about two blocks a second, that is under 85 minutes of history per call.
- **Fix:** Earmark never scans ranges. The activity feed walks each pocket's `prevEventBlock` pointers one block at a time (PRD Section 8), and the live poll is capped at 2,000-block windows.

## 2026-09-28: gas estimation for a USDC transfer works today, but the open issue stays open

- **Symptom:** `eth_estimateGas` for a zero-value USDC `transfer` returned `0x9760` (38,752 gas) on both networks. arc-node issue #80 (estimation failing for USDC writes) is still open.
- **Cause:** not reproduced yet; the reported failures involve the ERC-20 balance check under USDC-as-gas.
- **Fix:** keep the PRD's plan: estimate plus 20%, with fixed fallback limits (D7). The fallbacks are set from the Phase 1 gas report.

## 2026-09-28: base fee sits at the 20 gwei floor

- **Symptom:** `eth_feeHistory` over the last five blocks shows `baseFeePerGas` = `0x4a817c800` (20 gwei) on both networks.
- **Cause:** Arc's minimum base fee is 20 gwei, and transactions offering less are dropped without a receipt (Arc docs, EVM differences and Gas and fees).
- **Fix:** D6. At today's base fee, `maxFeePerGas` = max(25, 2 x 20 + 1) = 41 gwei and the tip is 1 gwei. The actual price paid stays at the base fee plus the tip.

## 2026-09-28: the wallet needs `gasLimit x maxFeePerGas` up front

- **Symptom:** none yet. Derived from the D6 fee cap: a wallet must hold the maximum possible fee before a write is accepted, not the fee actually charged.
- **Cause:** standard EIP-1559 balance check, which matters on Arc because the family member's only balance is the fee credit.
- **Fix:** the app keeps the fee credit at $0.05 or more when it is on (DECISIONS C25), and top-ups start below half of it. Re-check with measured gas in Phase 1.

## 2026-09-28: the "permissioned" mainnet RPC accepts browser requests

- **Symptom:** the Arc Microgrants Q&A says every listed mainnet RPC provider is permissioned. `rpc.mainnet.arc.io` still answered `eth_chainId` (`0x13b2`) and a CORS preflight (`204`, `access-control-allow-origin` echoing the origin) without a key.
- **Cause:** the primary public endpoint is open; the third-party providers need access requests.
- **Fix:** use the public endpoint, keep `VITE_RPC_URL` configurable, and handle an unreachable RPC with the "Could not reach Arc" state.

## 2026-09-28: load-balanced RPC backends can disagree about the head

- **Symptom:** reported in arc-node issue #454: a block returned as the head by one backend can return `-32014 requested data not available` from another.
- **Cause:** the public endpoint balances requests across nodes at slightly different heights.
- **Fix:** reads retry with backoff. A read that follows a write waits until the receipt's block is available.

## 2026-09-28: explorer verification is behind Cloudflare

- **Symptom:** reported in arc-node issues #425 and #454 and the Microgrants Q&A: `forge verify-contract --verifier blockscout` gets a Cloudflare challenge page or a 500 error. Sourcify verifies, but the explorer does not pick the result up.
- **Cause:** the explorer's `/api` sits behind a Cloudflare managed challenge.
- **Fix:** planned for Phase 7: Sourcify, then the explorer's web form by hand, and the standard JSON input committed to the repository either way.

## 2026-09-28: the public RPC sets a Cloudflare cookie

- **Symptom:** responses from `rpc.testnet.arc.io` include `set-cookie: __cf_bm=...; Domain=arc.io`.
- **Cause:** Cloudflare bot management in front of the RPC.
- **Fix:** Earmark sends cross-origin requests without credentials, so the browser should neither store nor send this cookie. Not yet verified: the Phase 5 network-tab check will confirm it.

## 2026-09-28: Multicall3 is deployed on both Arc networks

- **Symptom:** none; checked before relying on it. `eth_getCode` at `0xcA11bde05977b3631167028862bE2a173976CA11` returns 3,808 bytes on both `rpc.mainnet.arc.io` and `rpc.testnet.arc.io`.
- **Cause:** Arc ships the standard Multicall3.
- **Fix:** the app batches its reads through it, which cuts round trips on slow mobile data. The local rehearsal chain copies the same code from Arc testnet, because a bare anvil node has none. Without it, every read hung and the landing page sat on "Connect wallet". That also led to the landing page showing a loading or error state once a wallet is connected.

## 2026-09-28: a local EVM cannot rehearse the fee credit

- **Symptom:** on anvil the family wallet's USDC never drops after paying, so no "Fee credit added" rows appear after spends.
- **Cause:** anvil charges network fees in ETH. On Arc they come out of the same USDC balance the fee credit fills (PRD A1, A10).
- **Fix:** the local rehearsal covers everything else. Top-ups after spending are checked on Arc testnet (docs/REHEARSAL.md, step 13).

## 2026-09-29: testnet deploy, fees and gas estimation confirmed on Arc

- **Symptom:** the first deploy attempt stopped at "Failed to decrypt keystore: incorrect password". Nothing was broadcast (deployer nonce stayed 0).
- **Cause:** not Arc. Hidden password input typed in Git Bash (MINGW64/mintty) on Windows is unreliable for Foundry's keystore prompt.
- **Fix:** type keystore passwords in Windows PowerShell (docs/DEPLOY.md). The retry deployed EarmarkPockets at `0x8670…18e4` in block 64652106.
- **Measured on Arc testnet:**
  - The deploy used 3,068,391 gas; Foundry's estimate was 3,988,908.
  - The effective price was 21 gwei: the 20 gwei base fee plus the 1 gwei tip, although `maxFeePerGas` was 41 gwei (D6). The fee was 0.0644 USDC.
  - `eth_estimateGas` worked for a USDC `approve` (56,253 gas) and a `createPocket` with no deposit (394,820 gas), both well under the D7 fallbacks.
  - arc-node issue #80 did not reproduce, and the app keeps its fallbacks anyway.
