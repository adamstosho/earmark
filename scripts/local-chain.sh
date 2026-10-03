#!/usr/bin/env bash
# Sets up a local chain that behaves like Arc testnet for development and the end-to-end check:
#   - chain id 5042002 and a 20 gwei base fee, like Arc testnet;
#   - a 6-decimal mock USDC placed at Arc's USDC address 0x3600…0000 (PRD A10: anvil is not Arc);
#   - EarmarkPockets deployed against it;
#   - USDC minted to the sender and a co-funder (the family wallet starts with none, as in the rehearsal).
# Uses anvil's unlocked development accounts, so no private key is ever handled.
#
# Usage: start `anvil --chain-id 5042002 --base-fee 20000000000` in another terminal, then run this from the repo root.
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
USDC=0x3600000000000000000000000000000000000000
SENDER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
FAMILY=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
COFUNDER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

cd "$(dirname "$0")/../contracts"
[ "$(cast chain-id --rpc-url "$RPC")" = "5042002" ] || { echo "Expected chain id 5042002 at $RPC"; exit 1; }

forge build --quiet
cast rpc --rpc-url "$RPC" anvil_setCode "$USDC" "$(forge inspect MockUSDC deployedBytecode)" > /dev/null
# Arc has Multicall3 at the usual address, and the app batches reads through it: copy its code from Arc testnet.
MULTICALL3=0xcA11bde05977b3631167028862bE2a173976CA11
cast rpc --rpc-url "$RPC" anvil_setCode "$MULTICALL3" "$(cast code --rpc-url https://rpc.testnet.arc.io "$MULTICALL3")" > /dev/null

OUT=$(forge create src/EarmarkPockets.sol:EarmarkPockets --rpc-url "$RPC" --unlocked --from "$SENDER" --broadcast --json --constructor-args "$USDC")
FLAT=$(echo "$OUT" | tr -d '\n')
POCKETS=$(echo "$FLAT" | sed -n 's/.*"deployedTo": *"\(0x[0-9a-fA-F]*\)".*/\1/p')
TX=$(echo "$FLAT" | sed -n 's/.*"transactionHash": *"\(0x[0-9a-fA-F]*\)".*/\1/p')
BLOCK=$(cast receipt --rpc-url "$RPC" "$TX" blockNumber)

cast send --rpc-url "$RPC" --unlocked --from "$SENDER" "$USDC" "mint(address,uint256)" "$SENDER" 1000000000 > /dev/null
cast send --rpc-url "$RPC" --unlocked --from "$SENDER" "$USDC" "mint(address,uint256)" "$COFUNDER" 100000000 > /dev/null

echo "VITE_NETWORK=arcTestnet"
echo "VITE_POCKETS_ADDRESS=$POCKETS"
echo "VITE_DEPLOY_BLOCK=$BLOCK"
echo "VITE_RPC_URL=$RPC"
echo "VITE_DEMO_POCKET_ID="
