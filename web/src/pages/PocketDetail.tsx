import { useState } from 'react';
import { copy } from '../copy';
import { Address, AllowanceMeter, AppBar, Button, EmptyState, IconButton, Money, Notice, PocketIcon } from '../ds/typed';
import { usePayees, usePendingRequests, usePocket } from '../data/hooks';
import { useFeed } from '../data/feed';
import { toDisplay } from '../lib/amounts';
import { hueName, iconName } from '../lib/appearance';
import { fromUnix, fullDate } from '../lib/dates';
import { savedName, useNames } from '../lib/names';
import { absoluteLink, navigate, paths } from '../lib/router';
import { sameAddress } from '../lib/text';
import { useIsCompact } from '../lib/viewport';
import { addressUrl } from '../config';
import {
  FeedList,
  PocketCardSkeleton,
  RequestCardSkeleton,
  RulesList,
  isLocked,
  periodWord,
  resetLabel,
} from '../components/Pockets';
import { AddMoneyTask, DecisionSheet, MoveLockSheet, TakeBackSheet } from '../components/Sheets';
import { PageNotices, SenderShell } from '../components/Shells';
import { LoadError, NairaNote, shareLink, useNairaRate, useWallet } from '../components/System';
import { RequestCards, requestTimes, type Decision } from './SenderDashboard';

/** Pocket page for the person who created it (/#/p/:id). */
export function PocketDetail({ id }: { id: bigint }) {
  const { address } = useWallet();
  const names = useNames();
  const rate = useNairaRate();
  const compact = useIsCompact();
  const pocket = usePocket(id);
  const p = pocket.data ?? undefined;
  const payees = usePayees(p ? id : undefined);
  const requests = usePendingRequests(p ? [p] : undefined);
  const feed = useFeed(p ? [p] : undefined, 30);
  const [sheet, setSheet] = useState<'add' | 'take' | 'lock' | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  if (p && sheet === 'add' && compact) return <AddMoneyTask pocket={p} onClose={() => setSheet(null)} />;

  const back = () => navigate(paths.send);

  if (pocket.isPending) {
    return (
      <SenderShell active="pockets">
        <AppBar title={copy.pocket.loading} back={{ label: copy.pocket.back, onClick: back }} />
        <div className="ek-page">
          <PocketCardSkeleton />
        </div>
      </SenderShell>
    );
  }

  if (pocket.isError && !p) {
    return (
      <SenderShell active="pockets">
        <div className="ek-page">
          <LoadError onRetry={() => void pocket.refetch()} />
        </div>
      </SenderShell>
    );
  }

  if (!p) {
    return (
      <SenderShell active="pockets">
        <div className="ek-page">
          <EmptyState
            icon="magnifying-glass"
            title={copy.pocket.notFoundTitle}
            action={
              <Button variant="primary" onClick={back}>
                {copy.pocket.goHome}
              </Button>
            }
          >
            {copy.pocket.notFoundBody}
          </EmptyState>
        </div>
      </SenderShell>
    );
  }

  const mine = sameAddress(address, p.sponsor);
  const locked = isLocked(p);
  const lockDate = fullDate(fromUnix(p.lockUntil));
  const pending = requests.data ?? [];
  const share = () => void shareLink(absoluteLink(paths.view(p.id)), p.label);

  return (
    <SenderShell active="pockets">
      <AppBar
        title={p.label}
        back={{ label: copy.pocket.back, onClick: back }}
        actions={<IconButton icon="share-network" label={copy.pocket.share} onClick={share} />}
      />
      <div className="ek-page">
        <PageNotices />
        <div className="ek-page__head app-head-wide">
          <div className="app-pockethead">
            <PocketIcon icon={iconName(p.icon)} hue={hueName(p.hue)} size="lg" />
            <h1 className="ek-page__title is-people">{p.label}</h1>
          </div>
        </div>

        {!mine ? (
          <div className="app-notices ek-stack">
            <Notice
              tone="info"
              title={copy.pocket.notYoursTitle}
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate(paths.view(p.id))}>
                  {copy.pocket.viewPublic}
                </Button>
              }
            >
              {copy.pocket.notYoursBody}
            </Notice>
          </div>
        ) : null}

        <div className="ek-split">
          <div className="ek-stack">
            <section className="app-card" aria-label={copy.pocket.inPocket}>
              <div className="app-pockethead">
                <PocketIcon icon={iconName(p.icon)} hue={hueName(p.hue)} size="lg" />
                <div className="app-grow">
                  <p className="ek-type-label-sm app-muted">{copy.pocket.inPocket}</p>
                  <Money value={toDisplay(p.balance)} size="hero" {...(rate !== undefined ? { rate } : {})} />
                </div>
              </div>
              <AllowanceMeter
                spent={toDisplay(p.spent)}
                limit={toDisplay(p.limit)}
                hue={hueName(p.hue)}
                periodLabel={periodWord(p)}
                resetLabel={resetLabel(p)}
              />
              <RulesList pocket={p} payeeCount={(payees.data ?? []).length} names={names} />
              {mine ? (
                <div className="app-row">
                  <Button variant="primary" iconStart="plus" onClick={() => setSheet('add')}>
                    {copy.pocket.addMoney}
                  </Button>
                  <Button
                    variant="secondary"
                    iconStart="arrow-counter-clockwise"
                    disabled={locked || p.balance === 0n}
                    aria-describedby={locked ? 'lock-reason' : undefined}
                    onClick={() => setSheet('take')}
                  >
                    {copy.pocket.takeBack}
                  </Button>
                  {locked ? (
                    <Button variant="ghost" iconStart="calendar-blank" onClick={() => setSheet('lock')}>
                      {copy.pocket.moveLock}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {locked ? (
                <p id="lock-reason" className="ek-type-body-sm app-muted">
                  {copy.pocket.lockedHint(lockDate)}
                </p>
              ) : null}
            </section>

            {locked ? (
              <Notice tone="lock" title={copy.pocket.lockTitle(lockDate)}>
                {copy.pocket.lockBody}
              </Notice>
            ) : null}

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

          <div className="ek-split__lead">
            <section className="ek-section" aria-labelledby="wt">
              <div className="ek-section__head">
                <h2 className="ek-section__title" id="wt">
                  {copy.dashboard.waiting}
                </h2>
              </div>
              {requests.isPending ? (
                <RequestCardSkeleton />
              ) : pending.length === 0 ? (
                <p className="ek-type-body-sm app-muted">{copy.dashboard.nothingWaiting}</p>
              ) : (
                <RequestCards requests={pending} pockets={[p]} times={requestTimes(feed.events)} busy={decision} onDecide={setDecision} />
              )}
            </section>

            <section className="ek-section" aria-labelledby="py">
              <div className="ek-section__head">
                <h2 className="ek-section__title" id="py">
                  {copy.pocket.payees}
                </h2>
              </div>
              {(payees.data ?? []).length === 0 ? (
                <p className="ek-type-body-sm app-muted">{copy.pocket.noPayees}</p>
              ) : (
                <div className="ek-panel">
                  <ul className="app-list">
                    {(payees.data ?? []).map((a) => (
                      <li key={a}>
                        {savedName(names, a) ? <span className="app-grow ek-type-body">{savedName(names, a)}</span> : null}
                        <Address value={a} href={addressUrl(a)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
        <div className="ek-section">
          <NairaNote />
        </div>
      </div>

      {sheet === 'add' ? <AddMoneyTask pocket={p} onClose={() => setSheet(null)} /> : null}
      {sheet === 'take' ? <TakeBackSheet pocket={p} onClose={() => setSheet(null)} /> : null}
      {sheet === 'lock' ? <MoveLockSheet pocket={p} onClose={() => setSheet(null)} /> : null}
      {decision ? (
        <DecisionSheet request={decision.request} pocket={p} mode={decision.mode} onClose={() => setDecision(null)} />
      ) : null}
    </SenderShell>
  );
}

