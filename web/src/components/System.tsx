import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnect, useConnection, useConnectors, useSwitchChain } from 'wagmi';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import { Button, Icon, Notice } from '../ds/typed';
import { useRate } from '../data/hooks';
import { useLive } from '../data/live';
import { fullDate, timeOfDay } from '../lib/dates';
import { describeError } from '../lib/errors';
import { absoluteLink, paths } from '../lib/router';
import { showToast } from '../lib/toasts';
import { isMobileDevice } from '../lib/viewport';

/** The connected wallet, and whether it is on the configured Arc network. */
export function useWallet() {
  const env = useEnv();
  const conn = useConnection();
  const address = conn.status === 'connected' ? conn.address : undefined;
  return {
    address,
    status: conn.status,
    wrongNetwork: conn.status === 'connected' && conn.chainId !== env.config.chain.id,
  };
}

/** Wrong network (with "Switch to Arc", US-11) and Arc unreachable (with "Try again"). */
export function SystemNotices() {
  const env = useEnv();
  const { wrongNetwork } = useWallet();
  const live = useLive();
  const queryClient = useQueryClient();
  const switcher = useSwitchChain();
  const [switchError, setSwitchError] = useState<string | null>(null);

  return (
    <>
      {wrongNetwork ? (
        <Notice
          tone="caution"
          title={copy.system.wrongNetworkTitle}
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={switcher.isPending}
              onClick={() => {
                setSwitchError(null);
                switcher.mutate(
                  { chainId: env.config.chain.id },
                  { onError: (err) => setSwitchError(describeError(err)) },
                );
              }}
            >
              {copy.system.switchToArc}
            </Button>
          }
        >
          {switchError ?? copy.system.wrongNetwork}
        </Notice>
      ) : null}
      {live.failing ? (
        <Notice
          tone="negative"
          title={copy.system.unreachableTitle}
          action={
            <Button variant="secondary" size="sm" onClick={() => void queryClient.refetchQueries({ queryKey: ['earmark'] })}>
              {copy.system.tryAgain}
            </Button>
          }
        >
          {copy.system.unreachable}
          {live.lastOk ? ` ${copy.system.lastUpdated(timeOfDay(new Date(live.lastOk)))}.` : null}
        </Notice>
      ) : null}
    </>
  );
}

/** "Use small amounts while Earmark is being tested." (screen patterns guide: stays on the sender dashboard). */
export function PocNotice() {
  const env = useEnv();
  return (
    <Notice tone="info" title={copy.poc.title}>
      {copy.poc.body}
      {env.config.network === 'arcTestnet' ? ` ${copy.poc.testnet}` : null}
    </Notice>
  );
}

/** "Naira amounts are indicative, at the {date} rate." with the provider's required credit. Hidden without a rate. */
export function NairaNote() {
  const rate = useRate();
  if (!rate.data) return null;
  const when = new Date(rate.data.updatedAt);
  return (
    <p className="app-note ek-type-caption">
      <Icon name="info" size={16} />
      <span>
        {copy.system.nairaNote(`${fullDate(when)}, ${timeOfDay(when)}`)}{' '}
        <a className="app-inline-link" href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
          {copy.system.rateCredit}
        </a>
      </span>
    </p>
  );
}

/** Naira per USDC for display, or undefined so every naira figure disappears (US-10). */
export function useNairaRate(): number | undefined {
  return useRate().data?.rate;
}

function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && typeof (window as { ethereum?: unknown }).ethereum !== 'undefined';
}

export async function copyText(text: string, done: string = copy.toast.copied): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(done, 'neutral');
  } catch {
    showToast(text, 'neutral');
  }
}

/** Connect wallet (injected only). Without a wallet, one line on what to do, with Copy link on phones (D12). */
export function ConnectButton({ block = false, size = 'lg' }: { block?: boolean; size?: 'md' | 'lg' }) {
  const connectors = useConnectors();
  const connect = useConnect();
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  // Wallets that announce themselves (EIP-6963) each get their own button; the generic injected connector is the
  // fallback for in-app browsers that only set window.ethereum.
  const announced = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
  const generic = connectors.find((c) => c.id === 'injected');
  const options = announced.length > 0 ? announced : hasInjectedWallet() && generic ? [generic] : [];

  const start = (connector: (typeof connectors)[number]) => {
    setError(null);
    connect.mutate({ connector }, { onError: (err) => setError(describeError(err)) });
  };

  if (options.length === 0) {
    const phone = isMobileDevice();
    return (
      <div className="app-stack-sm">
        <p className="ek-type-body-sm app-muted">{phone ? copy.wallet.phone : copy.wallet.none}</p>
        {phone ? (
          <div>
            <Button variant="secondary" iconStart="copy" onClick={() => void copyText(window.location.href, copy.wallet.linkCopied)}>
              {copy.wallet.copyLink}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const only = options.length === 1 ? options[0] : undefined;

  return (
    <div className="app-stack-sm">
      {choosing && !only ? (
        <div className="app-stack-sm" role="group" aria-label={copy.wallet.choose}>
          <p className="ek-type-label">{copy.wallet.choose}</p>
          {options.map((c) => (
            <Button key={c.uid} variant="secondary" size={size} block={block} loading={connect.isPending && connect.variables.connector === c} onClick={() => start(c)}>
              {c.name}
            </Button>
          ))}
        </div>
      ) : (
        <Button
          variant="primary"
          size={size}
          block={block}
          iconStart="wallet"
          loading={connect.isPending}
          onClick={() => (only ? start(only) : setChoosing(true))}
        >
          {connect.isPending ? copy.wallet.connecting : copy.wallet.connect}
        </Button>
      )}
      {error ? <p className="ek-type-body-sm app-muted" role="alert">{error}</p> : null}
    </div>
  );
}

/** The family link (D11) to copy or share. */
export function familyLink(): string {
  return absoluteLink(paths.family);
}

export async function shareLink(url: string, title: string): Promise<void> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, url });
      return;
    } catch {
      // Cancelled or unsupported: fall back to copying.
    }
  }
  await copyText(url);
}

/** A read from Arc failed: say so and offer Try again. Callers keep any data they already have on screen. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice
      tone="negative"
      title={copy.system.unreachableTitle}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {copy.system.tryAgain}
        </Button>
      }
    >
      {copy.system.unreachable}
    </Notice>
  );
}
