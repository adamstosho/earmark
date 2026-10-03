# Gas

Measured on 28 September 2026 with Foundry 1.8.3 (Solidity 0.8.28, optimizer 200 runs, `cancun`), against the 6-decimal `MockUSDC`. Arc's own USDC interface may cost somewhat more per transfer, so every figure below is re-checked with `eth_estimateGas` on Arc testnet after the Phase 2 deploy.

## What a write costs on Arc

Arc charges network fees in USDC. The base fee has sat at the 20 gwei floor in every block we checked (see `FRICTION-LOG.md`), so:

| Write | Typical execution gas | At 20 gwei plus a 1 gwei tip |
| --- | --- | --- |
| `spend` within the rules | about 69,000 (median) plus 21,000 base | about $0.0019 |
| `fund` | about 73,000 plus 21,000 base | about $0.0020 |
| `createPocket` with 1 payee and a deposit | about 356,000 plus 21,000 base | about $0.0079 |

The first `request` on a pocket is the most expensive regular action (up to 320,000 execution gas), because it writes about ten fresh storage slots: the request itself, its 64-byte memo, the pocket's request list, the pending count and the global counter. It still costs well under a cent.

## Worst case per write (D7)

Worst case = 10 payees, a 32-byte label, a 64-byte memo, first-time recipients (cold storage) and a fee-credit top-up to an empty wallet. `test/GasWorstCase.t.sol` measures it; the figure is execution gas plus the 21,000 intrinsic cost plus calldata, which is what a transaction's gas limit must cover. Where the full suite's gas report showed a higher maximum, that figure was used instead.

| Write | Worst case (gas) | + 30% | PRD floor | Fallback limit used by the app |
| --- | --- | --- | --- | --- |
| USDC `approve` | 73,358 (mock) | 95,366 | 100,000 | **100,000** |
| `createPocket` | 940,418 | 1,222,544 | 600,000 | **1,225,000** |
| `fund` | 131,828 | 171,377 | 150,000 | **175,000** |
| `spend` | 154,645 | 201,039 | 250,000 | **250,000** |
| `request` | 348,807 | 453,450 | 250,000 | **455,000** |
| `approveRequest` | 112,993 | 146,891 | 200,000 | **200,000** |
| `declineRequest` | 70,191 | 91,249 | none | **95,000** |
| `withdraw` | 99,459 | 129,297 | none | **130,000** |
| `extendLock` | 63,359 | 82,367 | none | **85,000** |
| `setPayee` | 125,319 | 162,915 | none | **165,000** |
| `setLimit` | 77,216 | 100,381 | none | **105,000** |
| `cancelRequest` | 70,096 | 91,125 | none | **95,000** |

Fallbacks are rounded up to the next 5,000. The app always tries `eth_estimateGas` first and adds 20%; these limits are used only when estimation fails (arc-node issue #80).

Re-measured on 30 September 2026 after `fund` began topping up the family member (DECISIONS C56). `fund` is the limit that rose: its worst case now includes a period roll and a top-up to an empty wallet. The other limits stayed, including where this run measured a little less, because that run follows a warmer sequence than the first measurement.

### Why the fallback matters for the family member's fee credit

A wallet must hold `gasLimit x maxFeePerGas` before a write is accepted, not just the fee actually charged. With D6's cap of 41 gwei at today's base fee:

| Write by the family member | Limit | Up-front requirement | Actually charged (about) |
| --- | --- | --- | --- |
| `spend` (fallback) | 250,000 | $0.0103 | $0.0019 to $0.0032 |
| `request` (fallback) | 455,000 | $0.0187 | $0.0044 to $0.0073 |

The default fee credit is $0.05 and top-ups start below $0.025, so the family member can always cover the worst up-front requirement. This is why the app keeps the fee credit at $0.05 or more when it is on (DECISIONS C25).

## Full gas report (`forge test --gas-report`)

Execution gas per call across all 104 tests, including the fuzz and invariant runs (re-run on 30 Sep 2026 after `fund` began topping up the family member).

| Function | Min | Avg | Median | Max | Calls |
| --- | --- | --- | --- | --- | --- |
| `approveRequest` | 28,959 | 49,906 | 33,450 | 89,555 | 1,365 |
| `cancelRequest` | 28,925 | 38,351 | 33,408 | 48,896 | 1,668 |
| `createPocket` | 29,413 | 357,091 | 356,339 | 907,897 | 3,780 |
| `declineRequest` | 33,295 | 38,150 | 33,473 | 48,991 | 942 |
| `extendLock` | 29,150 | 34,788 | 36,903 | 36,903 | 2,243 |
| `fund` | 21,411 | 74,858 | 73,249 | 107,273 | 2,513 |
| `request` | 30,132 | 174,592 | 187,892 | 320,102 | 2,561 |
| `setLimit` | 29,182 | 40,303 | 38,928 | 58,816 | 1,905 |
| `setPayee` | 29,513 | 51,896 | 32,055 | 104,119 | 2,051 |
| `spend` | 30,130 | 60,144 | 68,591 | 126,300 | 7,637 |
| `withdraw` | 29,569 | 46,075 | 55,775 | 75,903 | 2,525 |

Minimums are reverting calls. The gas-report maximum for `fund` (107,273 execution gas) is below the worst-case total above, so the fallback stays on that worst-case figure. Deployment size: 14,213 bytes (limit 24,576).

## Storage layout note

`payeeOnly`, `icon` and `hue` sit next to `sponsor` in the `Pocket` struct, so the three share the sponsor's storage slot instead of taking a slot of their own. The PRD lists `payeeOnly` last; the order is otherwise as specified.

## Commands

```bash
cd contracts
forge test --gas-report
forge test --match-contract GasWorstCase -vv
```
