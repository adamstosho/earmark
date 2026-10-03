import { useState } from 'react';
import { copy } from '../copy';
import { Address, AllowanceMeter, Button, EmptyState, IconButton, Logo, Money, Notice, PocketIcon } from '../ds/typed';
import { usePayees, usePocket } from '../data/hooks';
import { useFeed } from '../data/feed';
import { toDisplay } from '../lib/amounts';
import { hueName, iconName } from '../lib/appearance';
import { useNames } from '../lib/names';
import { absoluteLink, paths } from '../lib/router';
import { useIsCompact } from '../lib/viewport';
import { FeedList, PocketCardSkeleton, RequestCardSkeleton, RulesList, periodWord, resetLabel } from '../components/Pockets';
import { AddMoneyTask } from '../components/Sheets';
import { ConnectButton, LoadError, NairaNote, PocNotice, SystemNotices, shareLink, useNairaRate, useWallet } from '../components/System';

/** Public pocket (/#/view/:id, US-09): read-only, no wallet needed. Co-funders can add money after connecting. */
export function PublicPocket({ id }: { id: bigint }) {
  const { address } = useWallet();
  const names = useNames();
  const rate = useNairaRate();
  const compact = useIsCompact();
  const pocket = usePocket(id);
  const p = pocket.data ?? undefined;
  const payees = usePayees(p ? id : undefined);
  const feed = useFeed(p ? [p] : undefined, 30);
  const [adding, setAdding] = useState(false);

  if (p && adding && compact) return <AddMoneyTask pocket={p} onClose={() => setAdding(false)} />;

  return (
    <div className="app-landing">
      <header className="app-topbar app-topbar--narrow">
        <a href={paths.landing} aria-label={copy.pocket.goHome}>
          <Logo variant="wordmark" />
        </a>
        {address ? <Address label={copy.nav.you} value={address} /> : null}
      </header>
      <main className="ek-page app-narrow" id="ek-main">
        <div className="app-notices ek-stack">
          <Notice tone="info" icon="eye">
            {copy.publicPage.banner}
          </Notice>
          <SystemNotices />
        </div>

        {pocket.isPending ? (
          <PocketCardSkeleton />
        ) : pocket.isError && !p ? (
          <LoadError onRetry={() => void pocket.refetch()} />
        ) : !p ? (
          <EmptyState
            icon="magnifying-glass"
            title={copy.pocket.notFoundTitle}
            action={
              <a className="ek-btn ek-btn--primary ek-btn--md" href={paths.landing}>
                <span className="ek-btn__label">{copy.pocket.goHome}</span>
              </a>
            }
          >
            {copy.pocket.notFoundBody}
          </EmptyState>
        ) : (
          <>
            <div className="ek-page__head">
              <div className="app-pockethead">
                <PocketIcon icon={iconName(p.icon)} hue={hueName(p.hue)} size="lg" />
                <h1 className="ek-page__title is-people">{p.label}</h1>
              </div>
              <IconButton
                icon="share-network"
                label={copy.pocket.share}
                variant="secondary"
                onClick={() => void shareLink(absoluteLink(paths.view(p.id)), p.label)}
              />
            </div>
            <div className="app-reading ek-stack">
              <div className="ek-stack">
                <section className="app-card" aria-label={copy.pocket.inPocket}>
                  <div>
                    <p className="ek-type-label-sm app-muted">{copy.pocket.inPocket}</p>
                    <Money value={toDisplay(p.balance)} size="hero" {...(rate !== undefined ? { rate } : {})} />
                  </div>
                  <AllowanceMeter
                    spent={toDisplay(p.spent)}
                    limit={toDisplay(p.limit)}
                    hue={hueName(p.hue)}
                    periodLabel={periodWord(p)}
                    resetLabel={resetLabel(p)}
                  />
                  <RulesList pocket={p} payeeCount={(payees.data ?? []).length} names={names} />
                  {address ? (
                    <div>
                      <Button variant="primary" iconStart="plus" onClick={() => setAdding(true)}>
                        {copy.pocket.addMoney}
                      </Button>
                    </div>
                  ) : (
                    <ConnectButton size="md" />
                  )}
                </section>
                <section className="ek-section" aria-labelledby="ac">
                  <div className="ek-section__head">
                    <h2 className="ek-section__title" id="ac">
                      {copy.dashboard.activity}
                    </h2>
                  </div>
                  {feed.loading ? (
                    <RequestCardSkeleton />
                  ) : feed.error ? (
                    <LoadError onRetry={feed.retry} />
                  ) : (
                    <FeedList
                      events={feed.events}
                      pockets={[p]}
                      me={address}
                      names={names}
                      hasOlder={feed.hasOlder}
                      loadingOlder={feed.loadingOlder}
                      onLoadOlder={feed.loadOlder}
                    />
                  )}
                </section>
              </div>
            </div>
            <div className="ek-section app-reading">
              <PocNotice />
              <NairaNote />
            </div>
          </>
        )}
      </main>
      {p && adding ? <AddMoneyTask pocket={p} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
