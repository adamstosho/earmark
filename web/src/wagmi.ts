import { createPublicClient, http as viemHttp } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors/injected';
import { arcMainnet, arcTestnet } from './chains';
import type { AppConfig } from './config';

// Injected wallets only (PRD Section 9): works in MetaMask, Rabby, OKX and Bitget, with no WalletConnect project id.
// EIP-6963 discovery is on, so each installed wallet is its own connector and one extension cannot answer for another
// (DECISIONS C55); the generic injected connector covers in-app browsers that only set `window.ethereum`.

export function makeWagmiConfig(cfg: AppConfig) {
  const transport = http(cfg.rpcUrl, { batch: { batchSize: 40, wait: 16 }, retryCount: 5 });
  return createConfig({
    chains: [cfg.chain],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    transports: { [arcMainnet.id]: transport, [arcTestnet.id]: transport },
    pollingInterval: 2_000,
  });
}

export type WagmiConfig = ReturnType<typeof makeWagmiConfig>;

declare module 'wagmi' {
  interface Register {
    config: WagmiConfig;
  }
}

/** Reads go straight to the configured RPC, batched through Multicall3 and JSON-RPC batches. */
export function makePublicClient(cfg: AppConfig) {
  return createPublicClient({
    chain: cfg.chain,
    transport: viemHttp(cfg.rpcUrl, { batch: { batchSize: 40, wait: 16 }, retryCount: 5, timeout: 15_000 }),
    batch: { multicall: { wait: 16 } },
    pollingInterval: 1_000,
  });
}

export type ArcPublicClient = ReturnType<typeof makePublicClient>;
