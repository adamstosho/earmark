import type { Address } from 'viem';
import { copy, type PeriodKind } from '../copy';
import { ActivityItem, ActivityList, Button, Icon, Skeleton, type PocketCardProps } from '../ds/typed';
import { useBlockTimes, useRequestDetails } from '../data/hooks';
import type { PocketView, RequestView } from '../data/pockets';
import type { FeedEvent } from '../lib/activity';
import { toDisplay, usd } from '../lib/amounts';
import { hueName, iconName } from '../lib/appearance';
import { fromUnix, fullDate, relativeTime, resetWhen, shortDate } from '../lib/dates';
import { displayName, type NameBook } from '../lib/names';
import { sameAddress } from '../lib/text';
import { receiptUrl } from '../config';

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

export function isLocked(p: PocketView): boolean {
  return p.lockUntil > nowSeconds();
}

export function periodWord(p: PocketView): string {
  return copy.period.word(p.periodKind);
}

export function resetLabel(p: PocketView): string {
  return copy.period.resets(resetWhen(fromUnix(p.nextReset), Number(p.periodLength / 86_400n)));
}

/** PocketCard props from a pocket read from Arc. Amounts cross to numbers only here (D13). */
export function pocketCardProps(p: PocketView, rate: number | undefined): PocketCardProps {
  return {
    label: p.label,
    icon: iconName(p.icon),
    hue: hueName(p.hue),
    balance: toDisplay(p.balance),
    limit: toDisplay(p.limit),
    spent: toDisplay(p.spent),
    periodLabel: periodWord(p),
    resetLabel: resetLabel(p),
    payeeOnly: p.payeeOnly,
    pending: Number(p.pending),
    ...(rate !== undefined ? { rate } : {}),
    ...(isLocked(p) ? { lockedUntil: shortDate(fromUnix(p.lockUntil)) } : {}),
  };
}

/** The rules as a short list with icons (pocket page and public page). */
export function RulesList({ pocket, payeeCount, names }: { pocket: PocketView; payeeCount: number; names: NameBook }) {
  const spender = displayName(names, pocket.spender);
  const locked = isLocked(pocket);
  return (
    <ul className="app-rules ek-type-body-sm" aria-label={copy.pocket.rulesTitle}>
      <li>
        <Icon name="user" size={20} />
        <span>{copy.pocket.ruleSpender(spender)}</span>
      </li>
      {pocket.limit > 0n ? (
        <li>
          <Icon name="calendar-blank" size={20} />
          <span>{copy.pocket.rulePeriod(usd(pocket.limit), copy.period.each(pocket.periodKind), resetLabel(pocket))}</span>
        </li>
      ) : null}
      <li>
        <Icon name="users-three" size={20} />
        <span>{pocket.payeeOnly ? copy.pocket.rulePayeeOnly(payeeCount) : copy.pocket.ruleAnyPayee}</span>
      </li>
      <li className={locked ? 'is-lock' : undefined}>
        <Icon name={locked ? 'lock-simple' : 'lock-simple-open'} size={20} />
        <span>{locked ? copy.pocket.ruleLocked(fullDate(fromUnix(pocket.lockUntil))) : copy.pocket.ruleNoLock}</span>
      </li>
      <li>
        <Icon name="drop" size={20} />
        <span>{pocket.fuelTarget > 0n ? copy.pocket.ruleFee(usd(pocket.fuelTarget), spender) : copy.pocket.ruleNoFee}</span>
      </li>
    </ul>
  );
}

/** Mirrors a pocket card while it loads from Arc: icon circle, two lines, balance, meter and buttons. */
export function PocketCardSkeleton() {
  return (
    <div className="app-card" aria-hidden="true">
      <div className="app-pockethead">
        <Skeleton width={44} height={44} radius="var(--radius-full)" />
        <div className="app-grow app-stack-sm">
          <Skeleton width="50%" height={18} />
          <Skeleton width="35%" height={14} />
        </div>
      </div>
      <Skeleton width="45%" height={30} />
      <Skeleton height={8} radius="var(--radius-full)" />
      <div className="app-row">
        <Skeleton width={120} height={44} radius="var(--radius-full)" />
      </div>
    </div>
  );
}

export function RequestCardSkeleton() {
  return (
    <div className="app-card" aria-hidden="true">
      <Skeleton width="40%" height={16} />
      <Skeleton width="30%" height={30} />
      <Skeleton lines={2} height={14} />
    </div>
  );
}

type ItemProps = Parameters<typeof ActivityItem>[0];

interface FeedContext {
  me: Address | undefined;
  names: NameBook;
  labels: Map<string, string>;
  periods: Map<string, PeriodKind>;
  requests: Map<string, RequestView> | undefined;
  times: Map<string, bigint> | undefined;
}

function memoOrNull(memo: string | undefined): string | null {
  return memo && memo.trim() !== '' ? memo : null;
}

/** One Earmark event as a feed row, in the content guide's words. Null for events that are not shown. */
export function feedItem(ev: FeedEvent, ctx: FeedContext): ItemProps | null {
  const label = ctx.labels.get(ev.pocketId.toString()) ?? '';
  const ts = ev.timestamp ?? ctx.times?.get(ev.blockNumber.toString()) ?? null;
  const base = {
    detail: label,
    href: receiptUrl(ev.txHash),
    ...(ts !== null ? { time: relativeTime(fromUnix(ts)) } : {}),
  };
  const name = (a: string) => (sameAddress(a, ctx.me) ? copy.nav.you : displayName(ctx.names, a));
  const e = ev.event;
  switch (e.eventName) {
    case 'Spent': {
      const memo = memoOrNull(e.args.memo);
      return {
        ...base,
        kind: 'spent',
        title: copy.activity.paid(name(e.args.to)),
        amount: toDisplay(e.args.amount),
        status: 'Final',
        detail: memo ? `${label} · ${copy.activity.note(memo)}` : label,
      };
    }
    case 'Funded':
      return {
        ...base,
        kind: 'funded',
        title: sameAddress(e.args.from, ctx.me) ? copy.activity.addedByYou : copy.activity.addedBy(name(e.args.from)),
        amount: toDisplay(e.args.amount),
      };
    case 'Requested': {
      const memo = memoOrNull(e.args.memo);
      const current = ctx.requests?.get(e.args.requestId.toString());
      return {
        ...base,
        kind: 'requested',
        title: memo ? copy.activity.askedFor(memo) : copy.activity.askedToPay(name(e.args.to)),
        amount: toDisplay(e.args.amount),
        ...(current === undefined || current.status === 'pending' ? { status: 'Pending' as const } : {}),
      };
    }
    case 'Approved': {
      const r = ctx.requests?.get(e.args.requestId.toString());
      const memo = memoOrNull(r?.memo);
      return {
        ...base,
        kind: 'approved',
        title: memo ? copy.activity.approvedMemo(memo) : copy.activity.approvedTo(r ? name(r.to) : ''),
        ...(r ? { amount: toDisplay(r.amount) } : {}),
        status: 'Final',
      };
    }
    case 'Declined': {
      const r = ctx.requests?.get(e.args.requestId.toString());
      const memo = memoOrNull(r?.memo);
      return {
        ...base,
        kind: 'declined',
        title: memo ? copy.activity.declinedMemo(memo) : copy.activity.declinedTo(r ? name(r.to) : ''),
        ...(r ? { amount: toDisplay(r.amount) } : {}),
        status: 'Declined',
      };
    }
    case 'Withdrawn':
      return {
        ...base,
        kind: 'withdrawn',
        title: sameAddress(e.args.to, ctx.me) ? copy.activity.tookBack : copy.activity.takenBack,
        amount: toDisplay(e.args.amount),
      };
    case 'Refuelled':
      return { ...base, kind: 'fee', title: copy.activity.feeCredit, amount: toDisplay(e.args.amount) };
    case 'LockExtended':
      return { ...base, kind: 'locked', title: copy.activity.lockMoved(fullDate(fromUnix(e.args.lockUntil))) };
    case 'PocketCreated':
      return { ...base, kind: 'created', title: copy.activity.created };
    case 'PayeeSet':
      return {
        ...base,
        kind: 'created',
        title: e.args.allowed ? copy.activity.payeeAdded(name(e.args.payee)) : copy.activity.payeeRemoved(name(e.args.payee)),
      };
    case 'LimitChanged': {
      const kind = ctx.periods.get(ev.pocketId.toString()) ?? 'other';
      return {
        ...base,
        kind: 'created',
        title:
          e.args.limitPerPeriod === 0n
            ? copy.activity.limitRequestOnly
            : copy.activity.limitChanged(usd(e.args.limitPerPeriod), copy.period.each(kind)),
      };
    }
    case 'Cancelled': {
      const r = ctx.requests?.get(e.args.requestId.toString());
      const memo = memoOrNull(r?.memo);
      return {
        ...base,
        kind: 'declined',
        title: memo ? copy.activity.cancelledMemo(memo) : copy.activity.cancelledTo(r ? name(r.to) : ''),
        ...(r ? { amount: toDisplay(r.amount) } : {}),
      };
    }
    default:
      return null;
  }
}

/** The request ids a list of events refers to, so Approved and Declined rows can show amount and note. */
function requestIdsOf(events: readonly FeedEvent[]): bigint[] {
  const ids: bigint[] = [];
  for (const ev of events) {
    const e = ev.event;
    if (
      e.eventName === 'Approved' ||
      e.eventName === 'Declined' ||
      e.eventName === 'Requested' ||
      e.eventName === 'Cancelled'
    ) {
      ids.push(e.args.requestId);
    }
  }
  return ids;
}

export function FeedList({
  events,
  pockets,
  me,
  names,
  limit,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: {
  events: readonly FeedEvent[];
  pockets: readonly PocketView[];
  me: Address | undefined;
  names: NameBook;
  limit?: number;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}) {
  const shown = limit !== undefined ? events.slice(0, limit) : events;
  const requests = useRequestDetails(requestIdsOf(shown));
  const missingTimes = shown.filter((e) => e.timestamp === null).map((e) => e.blockNumber);
  const times = useBlockTimes(missingTimes);
  const labels = new Map(pockets.map((p) => [p.id.toString(), p.label]));
  const periods = new Map(pockets.map((p) => [p.id.toString(), p.periodKind]));
  const ctx: FeedContext = { me, names, labels, periods, requests: requests.data, times: times.data };

  return (
    <div className="ek-stack">
      <div className="ek-panel">
        <ActivityList label={copy.activity.label}>
          {shown.map((ev) => {
            const props = feedItem(ev, ctx);
            return props ? <ActivityItem key={ev.key} {...props} /> : null;
          })}
        </ActivityList>
      </div>
      {hasOlder && onLoadOlder ? (
        <div>
          <Button variant="secondary" loading={loadingOlder ?? false} onClick={onLoadOlder}>
            {copy.activity.loadOlder}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
