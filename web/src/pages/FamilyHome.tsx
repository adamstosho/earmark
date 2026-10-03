import { copy } from '../copy';
import { EmptyState, Icon, Notice, PocketCard } from '../ds/typed';
import { usePockets, useRoles, useUsdcBalance } from '../data/hooks';
import { useFeed } from '../data/feed';
import type { PocketView } from '../data/pockets';
import type { FeedEvent } from '../lib/activity';
import { usd } from '../lib/amounts';
import { savedName, useNames } from '../lib/names';
import { navigate, paths } from '../lib/router';
import { sameAddress } from '../lib/text';
import { PocketCardSkeleton, pocketCardProps, periodWord } from '../components/Pockets';
import { FamilyShell, PageNotices } from '../components/Shells';
import { LoadError, NairaNote, useNairaRate, useWallet } from '../components/System';

const DAY_SECONDS = 86_400n;

/** The latest money someone else added in the last 24 hours, shown as a positive notice (screen patterns guide). */
function latestTopUp(events: readonly FeedEvent[], me: string | undefined): FeedEvent | undefined {
  const cutoff = BigInt(Math.floor(Date.now() / 1000)) - DAY_SECONDS;
  return events.find(
    (e) =>
      e.event.eventName === 'Funded' &&
      !sameAddress(e.event.args.from, me) &&
      e.timestamp !== null &&
      e.timestamp >= cutoff,
  );
}

/** Family home (/#/family): one card per pocket with what can be spent now, Pay and Ask. */
export function FamilyHome() {
  const { address } = useWallet();
  const names = useNames();
  const rate = useNairaRate();
  const roles = useRoles(address);
  const pockets = usePockets(roles.data?.spenderIds);
  const feed = useFeed(pockets.data, 10);
  const feeCredit = useUsdcBalance(address);
  const list = pockets.data ?? [];
  const loading = roles.isPending || (roles.data !== undefined && roles.data.spenderIds.length > 0 && pockets.isPending);
  const failed = (roles.isError && !roles.data) || (pockets.isError && !pockets.data);

  const sponsors = [...new Set(list.map((p) => p.sponsor.toLowerCase()))];
  const sponsorName = sponsors.length === 1 ? savedName(names, sponsors[0]) : undefined;
  const topUp = latestTopUp(feed.events, address);
  const topUpPocket: PocketView | undefined = topUp ? list.find((p) => p.id === topUp.pocketId) : undefined;

  return (
    <FamilyShell active="home">
      <div className="ek-page">
        <PageNotices />
        <div className="ek-page__head">
          <div>
            <p className="ek-page__eyebrow">{copy.family.greeting(new Date().getHours())}</p>
            <h1 className="ek-page__title">{copy.family.title}</h1>
            <p className="ek-page__lede">{sponsorName ? copy.family.ledeNamed(sponsorName) : copy.family.lede}</p>
          </div>
        </div>

        <div className="ek-stack app-reading">
          {failed ? <LoadError onRetry={() => void roles.refetch().then(() => pockets.refetch())} /> : null}
          {topUp && topUpPocket && topUp.event.eventName === 'Funded' ? (
            <Notice
              tone="positive"
              title={copy.family.topUpTitle(
                savedName(names, topUp.event.args.from) ?? copy.family.someone,
                usd(topUp.event.args.amount),
                topUpPocket.label,
              )}
            >
              {topUpPocket.limit > 0n
                ? copy.family.topUpBody(usd(topUpPocket.available), periodWord(topUpPocket))
                : copy.family.topUpAsk}
            </Notice>
          ) : null}

          {loading ? (
            <>
              <PocketCardSkeleton />
              <PocketCardSkeleton />
            </>
          ) : list.length === 0 && !failed ? (
            <EmptyState icon="wallet" title={copy.family.emptyTitle}>
              {sponsorName ? copy.family.emptyNamed(sponsorName) : copy.family.empty}
            </EmptyState>
          ) : (
            list.map((p) => (
              <PocketCard
                key={p.id.toString()}
                {...pocketCardProps(p, rate)}
                view="family"
                onPay={() => navigate(paths.pay(p.id))}
                onAsk={() => navigate(paths.ask(p.id))}
              />
            ))
          )}

          {list.length > 0 ? (
            <p className="app-note ek-type-body-sm">
              <Icon name="drop" size={16} />
              <span>{copy.family.feeLine(feeCredit.data !== undefined ? usd(feeCredit.data) : usd(0n))}</span>
            </p>
          ) : null}
          <p className="app-note ek-type-caption">
            <Icon name="info" size={16} />
            <span>{copy.system.walletDisplay}</span>
          </p>
          <NairaNote />
        </div>
      </div>
    </FamilyShell>
  );
}
