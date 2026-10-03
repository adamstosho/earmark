import { useState } from 'react';
import { copy } from '../copy';
import { EmptyState } from '../ds/typed';
import { usePendingRequests, usePockets, useRoles } from '../data/hooks';
import { useFeed } from '../data/feed';
import { RequestCardSkeleton } from '../components/Pockets';
import { DecisionSheet } from '../components/Sheets';
import { PageNotices, SenderShell } from '../components/Shells';
import { LoadError, NairaNote, useWallet } from '../components/System';
import { RequestCards, requestTimes, type Decision } from './SenderDashboard';

/** Requests (/#/requests): every payment waiting for the sender, across pockets. */
export function Requests() {
  const { address } = useWallet();
  const roles = useRoles(address);
  const pockets = usePockets(roles.data?.sponsorIds);
  const requests = usePendingRequests(pockets.data);
  const feed = useFeed(pockets.data, 30);
  const [decision, setDecision] = useState<Decision | null>(null);
  const list = pockets.data ?? [];
  const pending = requests.data ?? [];
  const loading = roles.isPending || pockets.isPending || requests.isPending;
  const failed = (pockets.isError && !pockets.data) || (requests.isError && !requests.data);

  return (
    <SenderShell active="requests">
      <div className="ek-page">
        <PageNotices />
        <div className="ek-page__head">
          <div>
            <h1 className="ek-page__title">{copy.requests.title}</h1>
            <p className="ek-page__lede">{copy.requests.lede}</p>
          </div>
        </div>
        <div className="ek-stack app-reading">
          {failed ? <LoadError onRetry={() => void requests.refetch()} /> : null}
          {loading ? (
            <>
              <RequestCardSkeleton />
              <RequestCardSkeleton />
            </>
          ) : pending.length === 0 ? (
            <EmptyState icon="hand-coins" title={copy.requests.emptyTitle}>
              {copy.requests.emptyBody}
            </EmptyState>
          ) : (
            <RequestCards requests={pending} pockets={list} times={requestTimes(feed.events)} busy={decision} onDecide={setDecision} />
          )}
          <NairaNote />
        </div>
      </div>
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
