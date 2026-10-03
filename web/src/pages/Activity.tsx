import { copy } from '../copy';
import { EmptyState } from '../ds/typed';
import { usePockets, useRoles } from '../data/hooks';
import { useFeed } from '../data/feed';
import { useNames } from '../lib/names';
import { FeedList, RequestCardSkeleton } from '../components/Pockets';
import { FamilyShell, PageNotices, SenderShell } from '../components/Shells';
import { LoadError, useWallet } from '../components/System';

/** The full feed for the connected wallet's pockets, as sender (/#/activity) or family (/#/family/activity). */
export function ActivityPage({ view }: { view: 'sender' | 'family' }) {
  const { address } = useWallet();
  const names = useNames();
  const roles = useRoles(address);
  const ids = view === 'sender' ? roles.data?.sponsorIds : roles.data?.spenderIds;
  const pockets = usePockets(ids);
  const feed = useFeed(pockets.data, 30);
  const list = pockets.data ?? [];
  const loading = roles.isPending || pockets.isPending || feed.loading;

  const body = (
    <div className="ek-page">
      <PageNotices />
      <div className="ek-page__head">
        <div>
          <h1 className="ek-page__title">{copy.activity.title}</h1>
          <p className="ek-page__lede">{view === 'sender' ? copy.activity.lede : copy.activity.familyLede}</p>
        </div>
      </div>
      <div className="app-reading ek-stack">
        {feed.error ? <LoadError onRetry={feed.retry} /> : null}
        {loading ? (
          <RequestCardSkeleton />
        ) : feed.events.length === 0 ? (
          <EmptyState icon="receipt" title={copy.activity.emptyTitle}>
            {copy.activity.emptyBody}
          </EmptyState>
        ) : (
          <FeedList
            events={feed.events}
            pockets={list}
            me={address}
            names={names}
            hasOlder={feed.hasOlder}
            loadingOlder={feed.loadingOlder}
            onLoadOlder={feed.loadOlder}
          />
        )}
      </div>
    </div>
  );

  return view === 'sender' ? (
    <SenderShell active="activity">{body}</SenderShell>
  ) : (
    <FamilyShell active="activity">{body}</FamilyShell>
  );
}
