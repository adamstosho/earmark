import { useState } from 'react';
import { copy } from '../copy';
import { Badge, Button, EmptyState, PocketCard, RequestCard } from '../ds/typed';
import { usePendingRequests, usePockets, useRoles } from '../data/hooks';
import { useFeed } from '../data/feed';
import type { PocketView, RequestView } from '../data/pockets';
import type { FeedEvent } from '../lib/activity';
import { naira, toDisplay, usd } from '../lib/amounts';
import { hueName, iconName } from '../lib/appearance';
import { fromUnix, relativeTime } from '../lib/dates';
import { displayName, useNames } from '../lib/names';
import { navigate, paths } from '../lib/router';
import { useIsCompact } from '../lib/viewport';
import { FeedList, PocketCardSkeleton, RequestCardSkeleton, pocketCardProps } from '../components/Pockets';
import { AddMoneyTask, DecisionSheet } from '../components/Sheets';
import { PageNotices, SenderShell } from '../components/Shells';
import { LoadError, NairaNote, PocNotice, familyLink, shareLink, useNairaRate, useWallet } from '../components/System';

export type Decision = { request: RequestView; mode: 'approve' | 'decline' };

/** When each request was made, from the Requested events already loaded in the feed. */
export function requestTimes(events: readonly FeedEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ev of events) {
    if (ev.event.eventName === 'Requested' && ev.timestamp !== null) {
      map.set(ev.event.args.requestId.toString(), relativeTime(fromUnix(ev.timestamp)));
    }
  }
  return map;
}

export function RequestCards({
  requests,
  pockets,
  times,
  busy,
  onDecide,
}: {
  requests: readonly RequestView[];
  pockets: readonly PocketView[];
  times: Map<string, string>;
  busy: Decision | null;
  onDecide: (d: Decision) => void;
}) {
  const rate = useNairaRate();
  const byId = new Map(pockets.map((p) => [p.id.toString(), p]));
  return (
    <>
      {requests.map((r) => {
        const pocket = byId.get(r.pocketId.toString());
        if (!pocket) return null;
        const time = times.get(r.id.toString());
        return (
          <RequestCard
            key={r.id.toString()}
            amount={toDisplay(r.amount)}
            to={r.to}
            memo={r.memo}
            pocketLabel={pocket.label}
            icon={iconName(pocket.icon)}
            hue={hueName(pocket.hue)}
            state={busy?.request.id === r.id ? (busy.mode === 'approve' ? 'approving' : 'declining') : 'pending'}
            onApprove={() => onDecide({ request: r, mode: 'approve' })}
            onDecline={() => onDecide({ request: r, mode: 'decline' })}
            {...(rate !== undefined ? { rate } : {})}
            {...(time ? { time } : {})}
          />
        );
      })}
    </>
  );
}

/** Sender dashboard (/#/send): pockets, requests waiting, recent activity. */
export function SenderDashboard() {
  const { address } = useWallet();
  const names = useNames();
  const rate = useNairaRate();
  const compact = useIsCompact();
  const roles = useRoles(address);
  const pockets = usePockets(roles.data?.sponsorIds);
  const requests = usePendingRequests(pockets.data);
  const feed = useFeed(pockets.data, 10);
  const [adding, setAdding] = useState<PocketView | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  if (adding && compact) return <AddMoneyTask pocket={adding} onClose={() => setAdding(null)} />;

  const list = pockets.data ?? [];
  const loading = roles.isPending || (roles.data !== undefined && roles.data.sponsorIds.length > 0 && pockets.isPending);
  const failed = (roles.isError && !roles.data) || (pockets.isError && !pockets.data);
  const total = list.reduce((sum, p) => sum + p.balance, 0n);
  const spenders = [...new Set(list.map((p) => p.spender.toLowerCase()))];
  const onlySpender = spenders.length === 1 ? list[0]?.spender : undefined;
  const nairaTotal = naira(total, rate);
  const lede =
    (onlySpender ? copy.dashboard.ledeFor(usd(total), displayName(names, onlySpender)) : copy.dashboard.ledeAll(usd(total))) +
    (nairaTotal ? copy.dashboard.about(nairaTotal) : '');
  const pending = requests.data ?? [];
  const empty = !loading && !failed && list.length === 0;

  return (
    <SenderShell active="pockets">
      <div className="ek-page">
        <PageNotices />
        <div className="ek-page__head">
          <div>
            {list.length > 0 ? <p className="ek-page__eyebrow">{copy.dashboard.eyebrow(list.length)}</p> : null}
            <h1 className="ek-page__title">{copy.dashboard.title}</h1>
            {list.length > 0 ? <p className="ek-page__lede ek-num">{lede}</p> : null}
          </div>
          <div className="app-row">
            {list.length > 0 ? (
              <Button variant="secondary" iconStart="share-network" onClick={() => void shareLink(familyLink(), copy.appName)}>
                {copy.dashboard.shareFamily}
              </Button>
            ) : null}
            <Button variant="primary" iconStart="plus" onClick={() => navigate(paths.newPocket)}>
              {copy.dashboard.newPocket}
            </Button>
          </div>
        </div>

        <div className="app-notices ek-stack">
          <PocNotice />
          {failed ? <LoadError onRetry={() => void roles.refetch().then(() => pockets.refetch())} /> : null}
        </div>

        {empty ? (
          <EmptyState
            icon="tag"
            title={copy.dashboard.emptyTitle}
            action={
              <Button variant="primary" iconStart="plus" onClick={() => navigate(paths.newPocket)}>
                {copy.dashboard.emptyAction}
              </Button>
            }
          >
            {copy.dashboard.emptyBody}
          </EmptyState>
        ) : (
          <div className="ek-split">
            <section className="ek-section" aria-labelledby="pk">
              <div className="ek-section__head">
                <h2 className="ek-section__title" id="pk">
                  {copy.dashboard.pockets}
                </h2>
              </div>
              <div className="ek-grid" aria-busy={loading || undefined}>
                {loading ? (
                  <>
                    <PocketCardSkeleton />
                    <PocketCardSkeleton />
                    <PocketCardSkeleton />
                  </>
                ) : (
                  list.map((p) => (
                    <PocketCard
                      key={p.id.toString()}
                      {...pocketCardProps(p, rate)}
                      view="sender"
                      href={paths.pocket(p.id)}
                      onAddMoney={() => setAdding(p)}
                    />
                  ))
                )}
              </div>
            </section>

            <div className="ek-split__lead">
              <section className="ek-section" aria-labelledby="wt">
                <div className="ek-section__head">
                  <h2 className="ek-section__title" id="wt">
                    {copy.dashboard.waiting}
                  </h2>
                  {pending.length > 0 ? <Badge tone="caution">{copy.dashboard.requestsBadge(pending.length)}</Badge> : null}
                </div>
                {loading || requests.isPending ? (
                  <RequestCardSkeleton />
                ) : pending.length === 0 ? (
                  <p className="ek-type-body-sm app-muted">{copy.dashboard.nothingWaiting}</p>
                ) : (
                  <RequestCards
                    requests={pending}
                    pockets={list}
                    times={requestTimes(feed.events)}
                    busy={decision}
                    onDecide={setDecision}
                  />
                )}
              </section>

              <section className="ek-section" aria-labelledby="ac">
                <div className="ek-section__head">
                  <h2 className="ek-section__title" id="ac">
                    {copy.dashboard.activity}
                  </h2>
                  <a className="ek-link" href={paths.activity}>
                    {copy.dashboard.seeAll}
                  </a>
                </div>
                {feed.loading ? (
                  <RequestCardSkeleton />
                ) : feed.error ? (
                  <LoadError onRetry={feed.retry} />
                ) : feed.events.length === 0 ? (
                  <p className="ek-type-body-sm app-muted">{copy.dashboard.noActivity}</p>
                ) : (
                  <FeedList events={feed.events} pockets={list} me={address} names={names} limit={5} />
                )}
              </section>
            </div>
          </div>
        )}
        <div className="ek-section">
          <NairaNote />
        </div>
      </div>

      {adding ? <AddMoneyTask pocket={adding} onClose={() => setAdding(null)} /> : null}
      {decision
        ? (() => {
            const pocket = list.find((p) => p.id === decision.request.pocketId);
            return pocket ? (
              <DecisionSheet request={decision.request} pocket={pocket} mode={decision.mode} onClose={() => setDecision(null)} />
            ) : null;
          })()
        : null}
    </SenderShell>
  );
}
