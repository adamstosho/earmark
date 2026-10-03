import type { ReactNode } from 'react';
import type { Address as Addr } from 'viem';
import { copy } from '../copy';
import { Address, AppShell, EmptyState, type NavItem } from '../ds/typed';
import { usePockets, useRoles } from '../data/hooks';
import { KEYS, readItem, writeItem } from '../lib/storage';
import { paths } from '../lib/router';
import { PocketCardSkeleton } from './Pockets';
import { ConnectButton, SystemNotices, useWallet } from './System';

export type SenderTab = 'pockets' | 'requests' | 'activity' | 'settings';
export type FamilyTab = 'home' | 'activity' | 'settings';
export type View = 'sender' | 'family';

export function storedView(): View | null {
  const v = readItem(KEYS.view);
  return v === 'sender' || v === 'family' ? v : null;
}

export function setStoredView(view: View): void {
  writeItem(KEYS.view, view);
}

/** D10: a wallet that only spends lands on the family view; any other wallet on the sender view. */
export function homeFor(roles: { sponsorIds: readonly bigint[]; spenderIds: readonly bigint[] }): View {
  const funds = roles.sponsorIds.length > 0;
  const spends = roles.spenderIds.length > 0;
  if (spends && !funds) return 'family';
  if (spends && funds) return storedView() ?? 'sender';
  return 'sender';
}

export function homePath(view: View): string {
  return view === 'family' ? paths.family : paths.send;
}

function WalletFooter({ address }: { address: Addr | undefined }) {
  return address ? <Address label={copy.nav.you} value={address} /> : null;
}

/** System notices at the top of every signed-in page. */
export function PageNotices() {
  return (
    <div className="app-notices ek-stack">
      <SystemNotices />
    </div>
  );
}

export function SenderShell({ active, children }: { active: SenderTab; children: ReactNode }) {
  const { address } = useWallet();
  const roles = useRoles(address);
  const pockets = usePockets(roles.data?.sponsorIds);
  const waiting = (pockets.data ?? []).reduce((n, p) => n + Number(p.pending), 0);
  const nav: NavItem[] = [
    { icon: 'wallet', label: copy.nav.pockets, href: paths.send, active: active === 'pockets' },
    { icon: 'hand-coins', label: copy.nav.requests, href: paths.requests, active: active === 'requests', ...(waiting ? { badge: waiting } : {}) },
    { icon: 'receipt', label: copy.nav.activity, href: paths.activity, active: active === 'activity' },
    { icon: 'gear', label: copy.nav.settings, href: paths.settings, active: active === 'settings' },
  ];
  return (
    <AppShell nav={nav} navFooter={<WalletFooter address={address} />}>
      {children}
    </AppShell>
  );
}

export function FamilyShell({ active, children }: { active: FamilyTab; children: ReactNode }) {
  const { address } = useWallet();
  const nav: NavItem[] = [
    { icon: 'house', label: copy.nav.home, href: paths.family, active: active === 'home' },
    { icon: 'receipt', label: copy.nav.activity, href: paths.familyActivity, active: active === 'activity' },
    { icon: 'gear', label: copy.nav.settings, href: paths.settings, active: active === 'settings' },
  ];
  return (
    <AppShell nav={nav} navFooter={<WalletFooter address={address} />}>
      {children}
    </AppShell>
  );
}

/** Pages that read "your" pockets need a wallet; this shows Connect instead, or skeletons while reconnecting. */
export function ConnectGate({ children }: { children: ReactNode }) {
  const { address, status } = useWallet();
  if (address) return <>{children}</>;
  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <div className="ek-page">
        <div className="ek-grid">
          <PocketCardSkeleton />
          <PocketCardSkeleton />
        </div>
      </div>
    );
  }
  return (
    <div className="ek-page">
      <EmptyState icon="wallet" title={copy.wallet.gateTitle} action={<ConnectButton />}>
        {copy.wallet.gateBody}
      </EmptyState>
    </div>
  );
}
