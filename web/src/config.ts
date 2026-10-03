import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
import { CHAINS, type ArcChain, type NetworkName } from './chains';

export interface AppConfig {
  network: NetworkName;
  chain: ArcChain;
  pockets: Address;
  deployBlock: bigint;
  rpcUrl: string;
  explorer: string;
  demoPocketId: bigint | null;
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; problems: string[] };

export interface RawEnv {
  VITE_NETWORK?: string;
  VITE_POCKETS_ADDRESS?: string;
  VITE_DEPLOY_BLOCK?: string;
  VITE_RPC_URL?: string;
  VITE_DEMO_POCKET_ID?: string;
}

function isNetwork(value: string): value is NetworkName {
  return value in CHAINS;
}

function isRpcUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/** Validates the four required settings at start-up; the app shows every problem at once if any fail. */
export function readConfig(env: RawEnv): ConfigResult {
  const problems: string[] = [];
  const network = env.VITE_NETWORK?.trim() ?? '';
  const pockets = env.VITE_POCKETS_ADDRESS?.trim() ?? '';
  const deployBlock = env.VITE_DEPLOY_BLOCK?.trim() ?? '';
  const rpcUrl = env.VITE_RPC_URL?.trim() ?? '';
  const demo = env.VITE_DEMO_POCKET_ID?.trim() ?? '';

  if (!isNetwork(network)) problems.push('VITE_NETWORK must be arcTestnet or arcMainnet.');
  if (!isAddress(pockets, { strict: false }) || pockets.toLowerCase() === zeroAddress) {
    problems.push('VITE_POCKETS_ADDRESS must be the EarmarkPockets contract address.');
  }
  if (!/^\d+$/.test(deployBlock)) problems.push('VITE_DEPLOY_BLOCK must be the block number of the deployment.');
  if (!isRpcUrl(rpcUrl)) problems.push('VITE_RPC_URL must be an https address of an Arc RPC.');
  if (demo !== '' && !/^[1-9]\d*$/.test(demo)) problems.push('VITE_DEMO_POCKET_ID must be a pocket number, or empty.');

  if (problems.length > 0 || !isNetwork(network)) return { ok: false, problems };
  const chain = CHAINS[network];
  return {
    ok: true,
    config: {
      network,
      chain,
      pockets: getAddress(pockets),
      deployBlock: BigInt(deployBlock),
      rpcUrl,
      explorer: chain.blockExplorers.default.url,
      demoPocketId: demo === '' ? null : BigInt(demo),
    },
  };
}

export const configResult: ConfigResult = readConfig(import.meta.env);

/** The validated config. Only call after the start-up check has passed (main.tsx renders an error screen otherwise). */
export function appConfig(): AppConfig {
  if (!configResult.ok) throw new Error('Earmark is not configured');
  return configResult.config;
}

export function receiptUrl(hash: string): string {
  return `${appConfig().explorer}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${appConfig().explorer}/address/${address}`;
}
