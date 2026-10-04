import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useDisconnect } from 'wagmi';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import { Address, Button, Icon, IconButton, SegmentedControl, TextField } from '../ds/typed';
import { useRoles } from '../data/hooks';
import { removeName, setName, useNames } from '../lib/names';
import { navigate, paths } from '../lib/router';
import { parseAddress } from '../lib/text';
import { setThemePref, subscribeTheme, themePref, type ThemePref } from '../lib/theme';
import { addressUrl } from '../config';
import { FamilyShell, PageNotices, SenderShell, homeFor, setStoredView, type View } from '../components/Shells';
import { ConnectButton, copyText, familyLink, shareLink, useWallet } from '../components/System';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="ek-section" aria-labelledby={id}>
      <div className="ek-section__head">
        <h2 className="ek-section__title" id={id}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Settings (/#/settings): theme, view, names on this device, wallet and links. */
export function Settings() {
  const env = useEnv();
  const { address } = useWallet();
  const names = useNames();
  const roles = useRoles(address);
  const disconnect = useDisconnect();
  const theme = useSyncExternalStore(subscribeTheme, themePref);
  const [view, setView] = useState<View>(roles.data ? homeFor(roles.data) : 'sender');
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const funds = (roles.data?.sponsorIds.length ?? 0) > 0;
  const spends = (roles.data?.spenderIds.length ?? 0) > 0;
  const currentView: View = funds && spends ? view : spends ? 'family' : 'sender';

  const saveName = () => {
    const a = parseAddress(newAddress);
    if (a === null) {
      setNameError(copy.errors.badAddressFormat);
      return;
    }
    if (newName.trim() === '') return;
    setName(a, newName);
    setNewAddress('');
    setNewName('');
    setNameError(null);
  };

  const body = (
    <div className="ek-page">
      <PageNotices />
      <div className="ek-page__head">
        <div>
          <h1 className="ek-page__title">{copy.settings.title}</h1>
        </div>
      </div>
      <div className="app-reading">
        <Section id="appearance" title={copy.settings.appearance}>
          <SegmentedControl
            label={copy.settings.appearance}
            block
            value={theme}
            options={[...copy.settings.themeOptions]}
            onChange={(v) => {
              const pref: ThemePref = v === 'light' || v === 'dark' ? v : 'system';
              setThemePref(pref);
            }}
          />
        </Section>

        {funds && spends ? (
          <Section id="view" title={copy.settings.view}>
            <SegmentedControl
              label={copy.settings.view}
              block
              value={view}
              options={[...copy.settings.viewOptions]}
              onChange={(v) => {
                const next: View = v === 'family' ? 'family' : 'sender';
                setView(next);
                setStoredView(next);
              }}
            />
            <p className="ek-type-body-sm app-muted">{copy.settings.viewHint}</p>
          </Section>
        ) : null}

        {funds ? (
          <Section id="family-link" title={copy.settings.familyLink}>
            <p className="ek-type-body-sm app-muted">{copy.settings.familyLinkHint}</p>
            <div className="app-linkbox">
              <span className="app-grow ek-type-mono">{familyLink()}</span>
              <IconButton icon="copy" label={copy.create.copyFamily} onClick={() => void copyText(familyLink())} />
              <IconButton icon="share-network" label={copy.create.share} onClick={() => void shareLink(familyLink(), copy.appName)} />
            </div>
          </Section>
        ) : null}

        <Section id="names" title={copy.settings.names}>
          <p className="ek-type-body-sm app-muted">{copy.settings.namesHint}</p>
          {Object.keys(names).length === 0 ? (
            <p className="ek-type-body-sm app-muted">{copy.settings.noNames}</p>
          ) : (
            <div className="ek-panel">
              <ul className="app-list">
                {Object.entries(names).map(([a, n]) => (
                  <li key={a}>
                    <Icon name="user" size={20} />
                    <span className="app-grow ek-type-body">{n}</span>
                    <Address value={a} copy={false} />
                    <IconButton icon="x" label={copy.settings.removeName(n)} onClick={() => removeName(a)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="app-card">
            <TextField
              label={copy.settings.addressLabel}
              value={newAddress}
              mono
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="0x"
              onChange={(e) => setNewAddress(e.target.value)}
              {...(nameError ? { error: nameError } : {})}
            />
            <TextField
              label={copy.settings.nameLabel}
              value={newName}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setNewName(e.target.value)}
            />
            <div>
              <Button variant="secondary" iconStart="check" onClick={saveName}>
                {copy.settings.addName}
              </Button>
            </div>
          </div>
        </Section>

        <Section id="wallet" title={copy.settings.wallet}>
          {address ? (
            <div className="ek-stack">
              <Address value={address} href={addressUrl(address)} />
              <p className="app-note ek-type-caption">
                <Icon name="info" size={16} />
                <span>{copy.system.walletDisplay}</span>
              </p>
              <div>
                <Button
                  variant="secondary"
                  iconStart="sign-out"
                  onClick={() => disconnect.mutate(undefined, { onSettled: () => navigate(paths.landing) })}
                >
                  {copy.wallet.disconnect}
                </Button>
              </div>
            </div>
          ) : (
            <div className="ek-stack">
              <p className="ek-type-body-sm app-muted">{copy.settings.notConnected}</p>
              <ConnectButton size="md" />
            </div>
          )}
        </Section>

        <Section id="about" title={copy.settings.about}>
          <div className="app-stack-sm">
            <a className="ek-link" href={addressUrl(env.config.pockets)} target="_blank" rel="noopener noreferrer">
              {copy.settings.contract}
              <Icon name="arrow-square-out" size={16} />
            </a>
            <a className="ek-link" href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
              {copy.system.rateCredit}
              <Icon name="arrow-square-out" size={16} />
            </a>
          </div>
        </Section>
      </div>
    </div>
  );

  return currentView === 'family' ? (
    <FamilyShell active="settings">{body}</FamilyShell>
  ) : (
    <SenderShell active="settings">{body}</SenderShell>
  );
}
