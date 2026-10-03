import { createContext, useContext, type ReactNode } from 'react';
import type { AppConfig } from '../config';
import { rpcLogSource, type LogSource } from '../lib/activity';
import type { TxEnv } from '../lib/tx';
import type { ArcPublicClient, WagmiConfig } from '../wagmi';

export interface AppEnv {
  config: AppConfig;
  client: ArcPublicClient;
  wagmi: WagmiConfig;
  source: LogSource;
  tx: TxEnv;
}

const EnvContext = createContext<AppEnv | null>(null);

export function makeEnv(config: AppConfig, client: ArcPublicClient, wagmi: WagmiConfig): AppEnv {
  return {
    config,
    client,
    wagmi,
    source: rpcLogSource((args) => client.request(args as Parameters<typeof client.request>[0]), config.pockets),
    tx: { wagmi, client, chainId: config.chain.id, explorer: config.explorer },
  };
}

export function EnvProvider({ env, children }: { env: AppEnv; children: ReactNode }) {
  return <EnvContext.Provider value={env}>{children}</EnvContext.Provider>;
}

export function useEnv(): AppEnv {
  const env = useContext(EnvContext);
  if (!env) throw new Error('useEnv outside EnvProvider');
  return env;
}
