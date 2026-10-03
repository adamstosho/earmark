import './styles/tokens.css';
import './styles/earmark.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { App } from './App';
import { EnvProvider, makeEnv } from './app/env';
import { configResult } from './config';
import { ConfigError } from './pages/Misc';
import { makePublicClient, makeWagmiConfig } from './wagmi';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
const root = createRoot(container);

if (!configResult.ok) {
  root.render(
    <StrictMode>
      <ConfigError problems={configResult.problems} />
    </StrictMode>,
  );
} else {
  const config = configResult.config;
  const wagmi = makeWagmiConfig(config);
  const env = makeEnv(config, makePublicClient(config), wagmi);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 5_000, refetchOnWindowFocus: true },
    },
  });
  root.render(
    <StrictMode>
      <WagmiProvider config={wagmi}>
        <QueryClientProvider client={queryClient}>
          <EnvProvider env={env}>
            <App />
          </EnvProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>,
  );
}
