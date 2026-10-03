#!/usr/bin/env bash
# Restarts anvil (like Arc testnet) and redeploys, writing web/.env.local. For the local end-to-end rehearsal only.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$PATH:$HOME/.foundry/bin"
powershell -NoProfile -Command "Get-Process anvil -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || pkill anvil 2>/dev/null || true
sleep 1
nohup anvil --chain-id 5042002 --base-fee 20000000000 --port 8545 --silent > /dev/null 2>&1 &
for _ in $(seq 1 30); do cast chain-id --rpc-url http://127.0.0.1:8545 > /dev/null 2>&1 && break; sleep 0.5; done
bash scripts/local-chain.sh > web/.env.local
