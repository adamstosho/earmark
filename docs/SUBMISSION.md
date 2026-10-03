# Arc Microgrants submission (DoraHacks)

Ready to paste. Replace every `<…>` once mainnet is live (Phase 7). Submit by Sunday 4 October 2026; hard deadline 14 October, 23:59 ET (04:59 on 15 October in Lagos).

## Name

Earmark

## One-liner

Purpose-bound USDC pockets for money sent home, settled on Arc.

## Description

Families abroad send billions home every year, and once the money lands the sender loses all say in how it is used. Earmark lets a sender fund labelled pockets on Arc, such as school fees, food, rent and emergencies, and set simple rules: a weekly allowance, approved payees, requests above the limit, and an optional commitment lock the sender cannot reverse before a chosen date. Relatives in other countries can fund the same pocket. Every spend settles in under a second and appears on the sender's dashboard straight away.

The design follows field evidence. In a J-PAL study, simply letting migrants label remittances for education raised the amount they sent by more than 15 percent. Earmark turns that label into a rule enforced by software, following the Purpose Bound Money model published by the Monetary Authority of Singapore, applied to households on open rails.

## How Earmark uses Arc

- Pockets hold USDC through Arc's ERC-20 interface, so no second token is involved anywhere.
- Each pocket tops up the family member's gas from the same USDC, so a first-time user never has to buy a gas token.
- Deterministic finality means a spend is final by the time the sender sees it.
- Dollar-denominated fees of about a fifth of a cent per payment keep small, everyday allowances economical.

## Technical credibility (for the description or the repo link text)

- **Contract.** One immutable contract with no admin keys. 100 Foundry tests cover it, including all seven invariants over 25,600 random calls. Line and branch coverage is 100%, and Slither reports no high or medium findings.
- **Arc-specific handling.** Every Arc difference is handled and logged in `docs/FRICTION-LOG.md`: the 20 gwei fee floor, gas-estimation fallbacks, 6- versus 18-decimal USDC, the 10,000-block log limit, and load-balanced RPC lag.
- **No backend.** History is rebuilt by walking per-pocket event pointers, and a live two-second poll shows each spend on the sender's screen.
- **Accessibility.** Mobile-first, WCAG 2.2 AA (0 axe violations; Lighthouse accessibility 100), in light and dark.

## Links

| Field | Value |
| --- | --- |
| Live app | `<https://….vercel.app>` |
| Public repository | `<https://github.com/…/earmark>` |
| Contract on explorer.arc.io | `<https://explorer.arc.io/address/0x…>` |
| Demo pocket 1 | `<https://…/#/view/1>` |
| Demo pocket 2 | `<https://…/#/view/2>` |
| Demo pocket 3 | `<https://…/#/view/3>` |
| Demo video (YouTube, unlisted) | `<https://youtu.be/…>` |
| Builder profile | `<GitHub or X profile; pseudonymous is allowed>` |

## Final checklist before pressing Submit (PRD Section 14.2)

- [ ] Contract deployed and working on Arc mainnet (testnet-only builds are ineligible).
- [ ] Live app opens on a phone and a laptop with no errors.
- [ ] At least three demo pockets with real transactions of every type.
- [ ] Public repo with README, licence, tests, deployments and docs folder.
- [ ] No private key or `.env` file anywhere in Git history.
- [ ] Description names what Earmark does and what it uses Arc for.
- [ ] Builder profile public (GitHub, X or Farcaster).
- [ ] Payout wallet can receive USDC on Arc.
- [ ] One submission for this project only.
- [ ] Submitted by Sunday 4 October.
