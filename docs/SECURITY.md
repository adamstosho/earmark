# Security notes

Earmark is a proof of concept. The contract is immutable and unaudited, so the app asks people to use small amounts. This page records what was checked, how, and what is known.

## Design

- **No privileged roles.** `EarmarkPockets` has no owner, admin, pause, upgrade path, `delegatecall` or `selfdestruct`. Nobody, including the builder, can move money except through the rules below.
- **Three ways out.** Money leaves a pocket only by a spend within the rules (by the spender), an approved request (by the sponsor), or a withdrawal by the sponsor once any lock has ended. Fee-credit top-ups go only to the pocket's own spender, capped per period.
- **Rule changes.** Only the sponsor can add or remove approved payees (at most 10 active) or change the limit; only the spender can withdraw their own pending request. None of these moves money.
- **No native value.** No function is `payable` and there is no `receive()` or `fallback()`, so native USDC sent to the contract reverts. Money moves only through the 6-decimal ERC-20 interface (PRD A1).
- **Reentrancy.** Every write is `nonReentrant` (OpenZeppelin `ReentrancyGuard`), and state is updated and events emitted before each outgoing transfer. A test with a token that calls back into Earmark during a transfer confirms the guard (`ReentrancyTest`).
- **Transfers.** Every transfer uses OpenZeppelin `SafeERC20`. Deposits credit the balance actually received (tested with a fee-taking token).
- **Exact approvals.** The app asks for an allowance of exactly the amount being added, never an unlimited one, and skips the step only when the existing allowance already covers it.
- **Recipients.** A recipient is never the zero address or the contract itself (`InvalidAddress`). A USDC compliance block makes the whole call revert (tested with a blocklisting token), and the app says so in plain words (PRD A6).
- **Privacy.** Only addresses, amounts, short labels and optional notes go on-chain. The app warns that notes are public and suggests generic labels. Names people give each other stay in their own browser.

## Invariants (PRD Section 7.6)

Checked after every call of 256 random sequences of 100 calls each (25,600 calls), with authorised and unauthorised callers, time jumps, fee spending by the family member, payee and limit changes, and cancelled requests:

1. USDC held by the contract is at least the sum of all pocket balances.
2. `spentInPeriod` never exceeds `limitPerPeriod`: no spend ever takes it above the limit in force. It can sit above a limit the sponsor lowered during the same period (`setLimit` keeps what was already spent), and then nothing more can be spent until the next period (DECISIONS C53).
3. `fuelUsedInPeriod` never exceeds `fuelCapPerPeriod`.
4. No withdrawal succeeds before the lock date.
5. `lockUntil` never decreases.
6. Only the spender can spend, request or cancel a request; only the sponsor can approve, decline, withdraw, move the lock, or change payees or the limit.
7. A request leaves Pending at most once, and each pocket's pending count matches its pending requests.

## Test evidence (28 September 2026)

| Check | Command (in `contracts/`) | Result |
| --- | --- | --- |
| Unit, fuzz and invariant tests | `forge test` | 100 passed, 0 failed |
| Line coverage of `EarmarkPockets.sol` | `forge coverage --report summary` | 100.00% lines (215/215), 100.00% statements (270/270), 100.00% branches (49/49), 100.00% functions (33/33) |
| Static analysis | `slither .` (Slither 0.11.6) | 0 high, 0 medium, 5 low |
| Linter | `forge lint src` | 0 findings |

## Slither

`contracts/slither.config.json` limits analysis to `src/` (dependencies, tests and scripts are filtered out).

### Findings before triage

The first run reported 3 medium and 5 low findings. Each medium was reviewed by hand:

| Detector | Severity | Where | Verdict |
| --- | --- | --- | --- |
| `divide-before-multiply` | Medium | `_roll`: `start + ((now - start) / length) * length` | False positive. The division is the point: it floors elapsed time to whole periods so the period start stays on the pocket's own grid, as PRD Section 7.2 requires. An alternative using `%` was tried and Slither then reported `weak-prng` (High) for the same arithmetic, so the standard idiom was kept. |
| `incorrect-equality` | Medium | `_pull`: `received == 0` | False positive. It rejects a deposit that credited nothing. Extra USDC sent to the contract can only raise `received`, so nobody can use it to block or inflate a deposit. |
| `incorrect-equality` | Medium | `_refuel`: `amount == 0` | False positive. Zero means there is nothing to top up (cap used or pocket empty); the function returns without moving money. |

Each is suppressed on its line with a comment giving the reason, so a reviewer sees the reasoning next to the code.

### Findings after triage

```text
Number of informational issues: 0
Number of low issues: 5
Number of medium issues: 0
Number of high issues: 0
```

The 5 low findings are all `timestamp`: comparisons with `block.timestamp` in `createPocket`, `withdraw`, `extendLock`, `available` and `_roll`. These drive day-scale periods (1 to 31 days) and lock dates, where validator drift of seconds does not matter. PRD requirement A5 confirms Arc timestamps are fine for weekly periods and lock dates. The linter's matching `block-timestamp` lint is turned off in `foundry.toml` for the same reason.

## Known limitations

- **USDC sent straight to the contract is lost.** USDC transferred to the contract without `fund` is not credited to any pocket and cannot be recovered, because there is no admin to recover it.
- **Co-funders' money belongs to the pocket's creator.** The sponsor can take back anything in the pocket once any lock ends, including other people's contributions. The app warns co-funders before they add money.
- **No pause, no upgrade.** If a bug is found, the only remedy is a new contract; pockets on the old one keep their rules. This is why the app says "Use small amounts while Earmark is being tested".
- **Spender keys.** Whoever holds the spender's key can spend within the rules. The limit, payee list and lock bound the damage; requests still need the sponsor.
- **Request growth.** A pocket's list of requests grows for ever and `requestsOf` returns all of it. At most 20 can wait at once, which bounds the pending work, not the history.
- **Mock versus Arc USDC.** Local tests use a 6-decimal mock (PRD A10). Behaviour against Arc's own USDC is confirmed in the testnet rehearsal before mainnet.

## Keys and secrets

- The deployer key lives only in `contracts/.env`, which Git ignores; `contracts/.env.example` holds placeholders. Use a fresh wallet that holds only the deploy funds.
- The builder never asks for, reads, prints or stores a private key or seed phrase. The product owner runs every command that broadcasts.
- `git status` is checked before every commit.
