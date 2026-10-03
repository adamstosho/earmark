import { defineChain } from 'viem';

/** Arc's USDC ERC-20 interface: 6 decimals, the same balance as native USDC (PRD A1). */
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
export const USDC_DECIMALS = 6;

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Arc mainnet. Values from PRD Section 18.1, checked live on 28 Sep 2026. Native USDC uses 18 decimals. */
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc explorer', url: 'https://explorer.arc.io' } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/** Arc testnet. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc testnet explorer', url: 'https://explorer.testnet.arc.io' } },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: true,
});

export const CHAINS = { arcMainnet, arcTestnet } as const;
export type NetworkName = keyof typeof CHAINS;
export type ArcChain = (typeof CHAINS)[NetworkName];
