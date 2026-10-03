// Dates and times per the content guide: "12 min ago", "Today, 2:14 pm", "Yesterday, 9:05 am", "Mon 29 Sep",
// "12 Dec 2025"; lock dates in full ("12 Dec 2026") on pages and short ("12 Dec") on badges.

const DAY_MS = 86_400_000;

function clock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const weekdayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Feed and request times. */
export function relativeTime(when: Date, now: Date = new Date()): string {
  const diff = now.getTime() - when.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(when)) / DAY_MS);
  if (days === 0) return `Today, ${clock(when)}`;
  if (days === 1) return `Yesterday, ${clock(when)}`;
  if (days < 7) return `${weekday.format(when)} ${dayMonth.format(when)}`;
  return dayMonthYear.format(when);
}

/** "12 Dec 2026" */
export function fullDate(when: Date): string {
  return dayMonthYear.format(when);
}

/** "12 Dec" */
export function shortDate(when: Date): string {
  return dayMonth.format(when);
}

/** "2:14 pm" */
export function timeOfDay(when: Date): string {
  return clock(when);
}

/** When the allowance resets, worded for the period length: "Monday" (week), "2:14 pm" (day), "29 Oct" (other). */
export function resetWhen(next: Date, periodDays: number, now: Date = new Date()): string {
  if (periodDays === 1) {
    return startOfDay(next) === startOfDay(now) ? `at ${clock(next)}` : `tomorrow, ${clock(next)}`;
  }
  if (periodDays === 7) return weekdayLong.format(next);
  return dayMonth.format(next);
}

export function fromUnix(seconds: bigint | number): Date {
  return new Date(Number(seconds) * 1000);
}

/** yyyy-mm-dd in local time, for <input type="date">. */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A yyyy-mm-dd date as the end of that local day in Unix seconds, so "locked until 12 Dec" covers all of 12 Dec. */
export function endOfDayUnix(value: string): bigint | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  if (Number.isNaN(d.getTime())) return null;
  return BigInt(Math.floor(d.getTime() / 1000));
}
