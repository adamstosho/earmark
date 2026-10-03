# Deploying Earmark

The product owner runs every command that broadcasts. Nothing here needs the builder to see a key.

Run these in **Git Bash** from the repository root, with Foundry installed (`foundryup`).

> **Windows: type keystore passwords in PowerShell, not Git Bash.** Git Bash (MINGW64/mintty) can garble hidden password input, and Foundry then reports "Failed to decrypt keystore: incorrect password" (seen on 29 Sep 2026; nothing is broadcast when this happens). Run `cast wallet import`, `cast wallet address --account …` and the `forge script … --account …` deploy in **Windows PowerShell**. The PowerShell form of the fee lines is:
>
> ```powershell
> $env:Path += ";$HOME\.foundry\bin"
> cd $HOME\Desktop\ARC_HACKATHON\contracts
> $BASE = [int64](cast base-fee --rpc-url arc_testnet)
> $MAXFEE = [math]::Max([int64]25000000000, 2 * $BASE + 1000000000)
> forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast --account earmark-deployer --sender <DEPLOYER_ADDRESS> --with-gas-price $MAXFEE --priority-gas-price 1gwei
> ```

## 1. Choose how to sign

Pick **one**.

**A. Encrypted keystore (recommended).** The key is typed into Foundry once and stored encrypted; nothing sits in a plain file.

```bash
cast wallet import earmark-deployer --interactive   # paste the fresh deployer key, then choose a password
cast wallet address --account earmark-deployer       # prints the deployer address; note it
```

**B. `.env` file (PRD Section 12).**

```bash
cp contracts/.env.example contracts/.env   # then put the fresh deployer key in contracts/.env
git status --short contracts/.env          # must print nothing: .env is ignored
```

## 2. Arc testnet (chain 5042002)

```bash
cd contracts

# Check the network. Expect 5042002.
cast chain-id --rpc-url arc_testnet

# D6 fees: maxFeePerGas = max(25 gwei, 2 x base fee + 1 gwei); tip 1 gwei.
BASE=$(cast base-fee --rpc-url arc_testnet)
MAXFEE=$(( 2 * BASE + 1000000000 )); [ "$MAXFEE" -lt 25000000000 ] && MAXFEE=25000000000
echo "maxFeePerGas: $MAXFEE wei"

# Deploy, with A (keystore):
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast \
  --account earmark-deployer --sender <DEPLOYER_ADDRESS> \
  --with-gas-price "$MAXFEE" --priority-gas-price 1gwei

# ...or with B (.env):
set -a; source .env; set +a
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast \
  --with-gas-price "$MAXFEE" --priority-gas-price 1gwei
```

The script prints `EarmarkPockets: 0x…`. Then read back the transaction and its block:

```bash
node -p "require('./broadcast/Deploy.s.sol/5042002/run-latest.json').transactions[0].hash"
cast receipt --rpc-url arc_testnet <TX_HASH> blockNumber
cast call --rpc-url arc_testnet <EARMARK_ADDRESS> "usdc()(address)"   # expect 0x3600000000000000000000000000000000000000
```

Paste back: the contract address, the transaction hash and the block number.

## 3. Point the app at testnet

Create `web/.env.local` (ignored by Git):

```bash
VITE_NETWORK=arcTestnet
VITE_POCKETS_ADDRESS=<EARMARK_ADDRESS>
VITE_DEPLOY_BLOCK=<BLOCK_NUMBER>
VITE_RPC_URL=https://rpc.testnet.arc.io
VITE_DEMO_POCKET_ID=
```

Then `cd web && npm install && npm run dev`, and follow `docs/REHEARSAL.md`.

## 4. Arc mainnet (chain 5042), after the rehearsal passes

```bash
git tag v0.1.0 && git push --tags
cd contracts
cast chain-id --rpc-url arc_mainnet    # expect 5042
BASE=$(cast base-fee --rpc-url arc_mainnet)
MAXFEE=$(( 2 * BASE + 1000000000 )); [ "$MAXFEE" -lt 25000000000 ] && MAXFEE=25000000000
forge script script/Deploy.s.sol:Deploy --rpc-url arc_mainnet --broadcast \
  --account earmark-deployer --sender <DEPLOYER_ADDRESS> \
  --with-gas-price "$MAXFEE" --priority-gas-price 1gwei
node -p "require('./broadcast/Deploy.s.sol/5042/run-latest.json').transactions[0].hash"
cast receipt --rpc-url arc_mainnet <TX_HASH> blockNumber
```

## 5. Hosting on Vercel

- Import the GitHub repository. Root directory: `web`. Framework preset: Vite. Build command `npm run build`, output `dist` (the defaults).
- Environment variables (Production): `VITE_NETWORK=arcMainnet`, `VITE_POCKETS_ADDRESS`, `VITE_DEPLOY_BLOCK`, `VITE_RPC_URL=https://rpc.mainnet.arc.io`, and `VITE_DEMO_POCKET_ID` once a demo pocket exists.
- No rewrites: every route is a hash route (`/#/…`).

## 6. Source verification (PRD Section 12, step 15)

The explorer's API is behind a Cloudflare challenge (FRICTION-LOG), so:

```bash
cd contracts
forge verify-contract <EARMARK_ADDRESS> src/EarmarkPockets.sol:EarmarkPockets \
  --chain 5042 --verifier sourcify --constructor-args $(cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000)
forge verify-contract <EARMARK_ADDRESS> src/EarmarkPockets.sol:EarmarkPockets --show-standard-json-input > ../deployments/EarmarkPockets.standard-input.json
```

Then try the explorer's own verification form in a browser with that JSON, and commit `deployments/EarmarkPockets.standard-input.json` either way so anyone can rebuild the bytecode (Solidity 0.8.28, optimizer 200 runs, `cancun`).
