/*
 * Earmark design system: React 18 components.
 * Built as one classic script that reads window.React and assigns window.Earmark.
 * Styling lives in components/bundle.css and reads only the token custom properties.
 */
declare const React: any;
import ICONS from './icons.json';
import { TAG_PATH, RING_PATH, WORDMARK_PATH, WORDMARK_SCALE, WORDMARK_WIDTH } from './logo';

const ICON_MAP: Record<string, string> = ICONS as any;
const cx = (...a: any[]) => a.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ formatting */

const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ngn = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const MINUS = '−';

/** $1,240.50 ; with sign 'in' gives +$12.50, 'out' gives a true minus sign. */
export function formatUSDC(n: number, opts: { sign?: 'in' | 'out' } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  const sign = opts.sign === 'in' ? '+' : opts.sign === 'out' ? MINUS : v < 0 ? MINUS : '';
  return sign + '$' + usd.format(Math.abs(v));
}

/** ₦18,750, rounded to whole naira. */
export function formatNaira(n: number): string {
  return '₦' + ngn.format(Math.round(Number.isFinite(n) ? n : 0));
}

/** 0x3f2a…9c1e */
export function shortAddress(a: string): string {
  return a && a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a || '';
}

function sanitizeAmount(v: string): string {
  let s = String(v || '').replace(/[^0-9.]/g, '');
  const i = s.indexOf('.');
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
  return s.replace(/^0+(?=\d)/, '');
}

/** Applies one Keypad key to an amount string. Keeps two decimals and nine characters at most. */
export function applyKey(value: string, key: string): string {
  const v = value || '';
  if (key === 'back') return v.slice(0, -1);
  if (key === '.') return v.includes('.') ? v : (v || '0') + '.';
  const next = sanitizeAmount(v + key);
  return next.length > 9 ? v : next;
}

/* ------------------------------------------------------------------ primitives */

export function Icon({ name, size = 20, filled = false, label, className, style }: any) {
  const key = filled && ICON_MAP[name + '-fill'] ? name + '-fill' : name;
  const markup = ICON_MAP[key];
  if (!markup) return null;
  return (
    <svg
      className={cx('ek-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function Spinner() {
  return <span className="ek-spinner" aria-hidden="true" />;
}

function Sr({ children }: any) {
  return <span className="ek-sr">{children}</span>;
}

export function Logo({ variant = 'wordmark', className, label = 'Earmark' }: any) {
  const mark = (
    <g>
      <path className="ek-logo__tag" fillRule="evenodd" d={TAG_PATH} />
      <path className="ek-logo__ring" fillRule="evenodd" d={RING_PATH} />
    </g>
  );
  if (variant === 'mark') {
    return (
      <svg className={cx('ek-logo', 'ek-logo--mark', className)} viewBox="0 0 64 64" role="img" aria-label={label}>
        {mark}
      </svg>
    );
  }
  return (
    <svg className={cx('ek-logo', 'ek-logo--wordmark', className)} viewBox={`0 0 ${WORDMARK_WIDTH} 48`} role="img" aria-label={label}>
      <g transform="scale(0.75)">{mark}</g>
      <path className="ek-logo__word" transform={`translate(58 35) scale(${WORDMARK_SCALE})`} d={WORDMARK_PATH} />
    </svg>
  );
}

/* ------------------------------------------------------------------ actions */

export function Button({ variant = 'secondary', size = 'md', block, loading, iconStart, iconEnd, children, className, disabled, type = 'button', ...rest }: any) {
  const iconSize = size === 'sm' ? 16 : 20;
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('ek-btn', 'ek-btn--' + variant, 'ek-btn--' + size, block && 'ek-btn--block', loading && 'is-loading', className)}
    >
      {loading ? <Spinner /> : iconStart ? <Icon name={iconStart} size={iconSize} /> : null}
      <span className="ek-btn__label">{children}</span>
      {iconEnd && !loading ? <Icon name={iconEnd} size={iconSize} /> : null}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', filled, className, href, type = 'button', ...rest }: any) {
  const cls = cx('ek-iconbtn', 'ek-iconbtn--' + variant, 'ek-iconbtn--' + size, className);
  const glyph = <Icon name={icon} size={size === 'sm' ? 18 : 22} filled={filled} />;
  if (href) {
    return (
      <a href={href} {...rest} aria-label={label} title={label} className={cls}>
        {glyph}
      </a>
    );
  }
  return (
    <button type={type} {...rest} aria-label={label} title={label} className={cls}>
      {glyph}
    </button>
  );
}

/* ------------------------------------------------------------------ inputs */

export function TextField({ label, hint, error, prefix, suffix, mono, id, className, multiline, ...rest }: any) {
  const auto = React.useId();
  const fid = id || 'ek-f' + auto;
  const hintId = hint ? fid + '-hint' : undefined;
  const errId = error ? fid + '-err' : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  const Tag: any = multiline ? 'textarea' : 'input';
  return (
    <div className={cx('ek-field', error && 'is-invalid', className)}>
      <label className="ek-field__label" htmlFor={fid}>{label}</label>
      <div className={cx('ek-field__control', multiline && 'ek-field__control--multi')}>
        {prefix ? <span className="ek-field__affix">{prefix}</span> : null}
        <Tag id={fid} className={cx('ek-field__input', mono && 'ek-mono')} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
        {suffix ? <span className="ek-field__affix">{suffix}</span> : null}
      </div>
      {error ? (
        <p className="ek-field__error" id={errId}>
          <Icon name="warning-circle" size={16} filled />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? <p className="ek-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  );
}

export function AmountInput({ label = 'Amount', value = '', onChange, readOnly, rate, available, availableLabel = 'Available', error, id, autoFocus }: any) {
  const auto = React.useId();
  const fid = id || 'ek-a' + auto;
  const num = parseFloat(value || '0') || 0;
  const over = available != null && num > available;
  const message = error || (over ? 'More than is available. Ask for approval instead.' : null);
  return (
    <div className={cx('ek-amount', message && 'is-invalid')}>
      <label className="ek-amount__label" htmlFor={fid}>{label}</label>
      <div className="ek-amount__row">
        <span className="ek-amount__cur" aria-hidden="true">$</span>
        <input
          id={fid}
          className="ek-amount__input ek-num"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={value ? undefined : '0.00'}
          value={value}
          readOnly={readOnly}
          autoFocus={autoFocus}
          size={Math.max(4, (value || '0.00').length)}
          aria-invalid={message ? true : undefined}
          aria-describedby={fid + '-meta'}
          onChange={(e: any) => onChange && onChange(sanitizeAmount(e.target.value))}
        />
        <span className="ek-amount__unit">USDC</span>
      </div>
      <p className="ek-amount__meta" id={fid + '-meta'}>
        {message ? (
          <span className="ek-amount__error">
            <Icon name="warning-circle" size={16} filled />
            <span>{message}</span>
          </span>
        ) : (
          <>
            {rate && num > 0 ? (
              <span className="ek-num">
                {'≈ '}
                {formatNaira(num * rate)} <span className="ek-amount__note">indicative</span>
              </span>
            ) : null}
            {available != null ? (
              <span className="ek-num">
                {availableLabel} {formatUSDC(available)}
              </span>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export function Keypad({ onKey, label = 'Amount keypad' }: any) {
  return (
    <div className="ek-keypad" role="group" aria-label={label}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={cx('ek-keypad__key', k === 'back' && 'ek-keypad__key--back')}
          onClick={() => onKey && onKey(k)}
          aria-label={k === 'back' ? 'Delete last digit' : k === '.' ? 'Decimal point' : undefined}
        >
          {k === 'back' ? <Icon name="backspace" size={24} /> : k}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked = false, onChange, label, description, disabled, id }: any) {
  const auto = React.useId();
  const fid = id || 'ek-s' + auto;
  return (
    <div className={cx('ek-switchrow', disabled && 'is-disabled')}>
      <div className="ek-switchrow__text">
        <label htmlFor={fid} className="ek-switchrow__label">{label}</label>
        {description ? <p className="ek-switchrow__desc" id={fid + '-d'}>{description}</p> : null}
      </div>
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? fid + '-d' : undefined}
        disabled={disabled}
        className="ek-switch"
        onClick={() => onChange && onChange(!checked)}
      >
        <span className="ek-switch__thumb">{checked ? <Icon name="check" size={14} /> : null}</span>
      </button>
    </div>
  );
}

export function SegmentedControl({ options = [], value, onChange, label, block }: any) {
  const list = options.map((o: any) => (typeof o === 'string' ? { value: o, label: o } : o));
  const refs = React.useRef([] as any[]);
  const move = (dir: number) => {
    const i = list.findIndex((o: any) => o.value === value);
    const n = (i + dir + list.length) % list.length;
    onChange && onChange(list[n].value);
    const el = refs.current[n];
    if (el) el.focus();
  };
  return (
    <div
      className={cx('ek-seg', block && 'ek-seg--block')}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e: any) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      }}
    >
      {list.map((o: any, i: number) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el: any) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (value == null && i === 0) ? 0 : -1}
            className={cx('ek-seg__opt', on && 'is-on')}
            onClick={() => onChange && onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ display */

const BADGE_ICON: Record<string, string | null> = {
  neutral: null,
  brand: null,
  positive: 'check-circle',
  caution: 'clock',
  negative: 'x-circle',
  accent: 'lock-simple',
};
const FILLED = ['check-circle', 'x-circle', 'lock-simple', 'warning-circle', 'info'];

export function Badge({ tone = 'neutral', icon, children }: any) {
  const ic = icon === false ? null : icon || BADGE_ICON[tone];
  return (
    <span className={cx('ek-badge', 'ek-badge--' + tone)}>
      {ic ? <Icon name={ic} size={14} filled={FILLED.includes(ic)} /> : null}
      <span>{children}</span>
    </span>
  );
}

export function Money({ value = 0, rate, size = 'md', direction, naira = true, unit, align = 'start', className }: any) {
  const main = formatUSDC(value, { sign: direction });
  const showUnit = unit != null ? unit : size === 'hero';
  const ngnText = rate && naira ? formatNaira(Math.abs(value) * rate) : null;
  const spoken =
    (direction === 'in' ? 'plus ' : direction === 'out' ? 'minus ' : '') +
    usd.format(Math.abs(value)) +
    ' dollars' +
    (ngnText ? ', about ' + ngn.format(Math.round(Math.abs(value) * rate)) + ' naira' : '');
  return (
    <span className={cx('ek-money', 'ek-money--' + size, direction && 'ek-money--' + direction, 'ek-money--' + align, className)}>
      <span aria-hidden="true" className="ek-money__main ek-num">
        {main}
        {showUnit ? <span className="ek-money__unit">USDC</span> : null}
      </span>
      {ngnText ? (
        <span aria-hidden="true" className="ek-money__ngn ek-num">
          {'≈ '}
          {ngnText}
        </span>
      ) : null}
      <Sr>{spoken}</Sr>
    </span>
  );
}

export function Address({ value, label, copy = true, href }: any) {
  const [copied, setCopied] = React.useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      /* clipboard blocked: the full address stays in the title attribute */
    }
  };
  return (
    <span className="ek-address">
      {label ? <span className="ek-address__label">{label}</span> : null}
      <span className="ek-mono ek-address__value" title={value}>{shortAddress(value)}</span>
      {copy ? (
        <button type="button" className="ek-address__btn" onClick={doCopy} aria-label={copied ? 'Copied' : 'Copy full address'}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </button>
      ) : null}
      {href ? (
        <a className="ek-address__btn" href={href} target="_blank" rel="noopener noreferrer" aria-label="View on the Arc explorer, opens in a new tab">
          <Icon name="arrow-square-out" size={16} />
        </a>
      ) : null}
      <span className="ek-sr" aria-live="polite">{copied ? 'Address copied' : ''}</span>
    </span>
  );
}

export function PocketIcon({ icon = 'wallet', hue, size = 'md' }: any) {
  const px = size === 'lg' ? 28 : size === 'sm' ? 16 : 22;
  return (
    <span className={cx('ek-picon', 'ek-picon--' + size)} data-hue={hue || undefined} aria-hidden="true">
      <Icon name={icon} size={px} />
    </span>
  );
}

export function AllowanceMeter({ spent = 0, limit = 0, hue, periodLabel = 'this week', resetLabel }: any) {
  if (!limit) {
    return (
      <p className="ek-meter__none">
        <Icon name="hand-coins" size={16} />
        <span>Every payment from this pocket is a request</span>
      </p>
    );
  }
  const left = Math.max(0, limit - spent);
  const pct = Math.min(100, Math.max(0, (spent / limit) * 100));
  const state = left <= 0 ? 'full' : pct >= 80 ? 'near' : 'ok';
  const style: any = hue ? { '--ek-meter-fill': `var(--pocket-${hue})` } : undefined;
  return (
    <div className={cx('ek-meter', 'is-' + state)} style={style}>
      <div className="ek-meter__top">
        <span className="ek-meter__label">Available {periodLabel}</span>
        <span className="ek-meter__value ek-num">
          <strong>{formatUSDC(left)}</strong> of {formatUSDC(limit)}
        </span>
      </div>
      <div
        className="ek-meter__track"
        role="progressbar"
        aria-label={'Used ' + periodLabel}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(spent, limit)}
        aria-valuetext={`${formatUSDC(spent)} of ${formatUSDC(limit)} used ${periodLabel}`}
      >
        <span className="ek-meter__fill" style={{ width: pct + '%' }} />
      </div>
      {state !== 'ok' || resetLabel ? (
        <div className="ek-meter__foot">
          {state === 'full' ? (
            <span className="ek-meter__warn">
              <Icon name="warning-circle" size={16} filled />
              Limit reached. Ask for approval.
            </span>
          ) : state === 'near' ? (
            <span className="ek-meter__warn">
              <Icon name="warning" size={16} />
              Almost used
            </span>
          ) : (
            <span />
          )}
          {resetLabel ? <span className="ek-meter__reset">{resetLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PocketCard({
  label,
  icon,
  hue,
  balance = 0,
  rate,
  limit = 0,
  spent = 0,
  periodLabel,
  resetLabel,
  lockedUntil,
  pending = 0,
  payeeOnly,
  view = 'sender',
  href,
  onOpen,
  onPay,
  onAsk,
  onAddMoney,
}: any) {
  const titleId = React.useId();
  const canPay = limit > 0 && limit - spent > 0 && balance > 0;
  return (
    <article className={cx('ek-pocket', 'ek-pocket--' + view)} aria-labelledby={titleId}>
      <header className="ek-pocket__head">
        <PocketIcon icon={icon} hue={hue} />
        <div className="ek-pocket__title">
          {href ? (
            <a id={titleId} className="ek-pocket__label" href={href}>{label}</a>
          ) : onOpen ? (
            <button id={titleId} type="button" className="ek-pocket__label" onClick={onOpen}>{label}</button>
          ) : (
            <h3 id={titleId} className="ek-pocket__label">{label}</h3>
          )}
          <div className="ek-pocket__badges">
            {view === 'sender' && lockedUntil ? <Badge tone="accent">Locked until {lockedUntil}</Badge> : null}
            {payeeOnly ? (
              <Badge tone="neutral" icon="users-three">
                Approved payees only
              </Badge>
            ) : null}
            {view === 'sender' && pending ? (
              <Badge tone="caution">
                {pending} {pending === 1 ? 'request' : 'requests'}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>
      <div className="ek-pocket__balance">
        <span className="ek-pocket__caption">In this pocket</span>
        <Money value={balance} rate={rate} size="lg" />
      </div>
      <AllowanceMeter spent={spent} limit={limit} hue={hue} periodLabel={periodLabel} resetLabel={resetLabel} />
      <footer className={cx('ek-pocket__actions', view === 'family' && !limit && 'ek-pocket__actions--single')}>
        {view === 'family' ? (
          !limit ? (
            <Button variant="tonal" iconStart="hand-coins" onClick={onAsk} block>
              Ask for a payment
            </Button>
          ) : (
            <>
              <Button variant="tonal" iconStart="arrow-up-right" onClick={onPay} disabled={!canPay}>
                Pay
              </Button>
              <Button variant="ghost" iconStart="hand-coins" onClick={onAsk}>
                Ask
              </Button>
            </>
          )
        ) : (
          <>
            <Button variant="tonal" iconStart="plus" onClick={onAddMoney}>
              Add money
            </Button>
            <IconButton icon="caret-right" label={'Open ' + label} href={href} onClick={onOpen} className="ek-pocket__open" />
          </>
        )}
      </footer>
    </article>
  );
}

const ACTIVITY: Record<string, { icon: string; dir?: 'in' | 'out' }> = {
  spent: { icon: 'arrow-up-right', dir: 'out' },
  funded: { icon: 'arrow-down-left', dir: 'in' },
  requested: { icon: 'hand-coins' },
  approved: { icon: 'check-circle', dir: 'out' },
  declined: { icon: 'x-circle' },
  withdrawn: { icon: 'arrow-counter-clockwise', dir: 'out' },
  fee: { icon: 'drop', dir: 'out' },
  locked: { icon: 'lock-simple' },
  created: { icon: 'tag' },
};
const STATUS_TONE: Record<string, string> = { Pending: 'caution', Final: 'positive', Declined: 'negative', Failed: 'negative' };

export function ActivityList({ children, label = 'Activity' }: any) {
  return (
    <ul className="ek-activitylist" aria-label={label}>
      {children}
    </ul>
  );
}

export function ActivityItem({ kind = 'spent', title, detail, amount, time, status, href }: any) {
  const k = ACTIVITY[kind] || ACTIVITY.spent;
  return (
    <li className={cx('ek-activity', 'is-' + kind)}>
      <span className={cx('ek-activity__icon', 'is-' + kind)}>
        <Icon name={k.icon} size={20} />
      </span>
      <div className="ek-activity__main">
        <p className="ek-activity__title">{title}</p>
        <p className="ek-activity__detail">
          {detail}
          {detail && time ? ' · ' : null}
          {time ? <time>{time}</time> : null}
        </p>
      </div>
      <div className="ek-activity__side">
        {amount != null ? <Money value={amount} direction={k.dir} size="md" naira={false} align="end" /> : null}
        {status ? <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge> : null}
      </div>
      {href ? (
        <a className="ek-activity__link" href={href} target="_blank" rel="noopener noreferrer" aria-label="View receipt on the Arc explorer, opens in a new tab">
          <Icon name="arrow-square-out" size={18} />
        </a>
      ) : (
        <span className="ek-activity__spacer" aria-hidden="true" />
      )}
    </li>
  );
}

export function RequestCard({ amount = 0, rate, to, memo, pocketLabel, hue, icon, time, state = 'pending', onApprove, onDecline }: any) {
  const busy = state === 'approving' || state === 'declining';
  return (
    <article className="ek-request" aria-label={`Request from ${pocketLabel}`}>
      <header className="ek-request__head">
        <PocketIcon icon={icon} hue={hue} size="sm" />
        <span className="ek-request__pocket">{pocketLabel}</span>
        {time ? <time className="ek-request__time">{time}</time> : null}
      </header>
      <Money value={amount} rate={rate} size="lg" />
      {memo ? <p className="ek-request__memo">{'“' + memo + '”'}</p> : null}
      {to ? (
        <p className="ek-request__to">
          <span>To</span> <Address value={to} />
        </p>
      ) : null}
      <footer className="ek-request__actions">
        <Button variant="ghost" onClick={onDecline} loading={state === 'declining'} disabled={busy}>
          Decline
        </Button>
        <Button variant="tonal" iconStart="check" onClick={onApprove} loading={state === 'approving'} disabled={busy}>
          Approve and pay
        </Button>
      </footer>
    </article>
  );
}

export function TxStatus({ title, steps = [], href, hrefLabel = 'View receipt' }: any) {
  return (
    <div className="ek-tx" role="status" aria-live="polite">
      {title ? <p className="ek-tx__title">{title}</p> : null}
      <ol className="ek-tx__steps">
        {steps.map((s: any, i: number) => (
          <li key={i} className={cx('ek-tx__step', 'is-' + (s.state || 'todo'))}>
            <span className="ek-tx__mark">
              {s.state === 'active' ? (
                <Spinner />
              ) : s.state === 'done' ? (
                <Icon name="check-circle" size={22} filled />
              ) : s.state === 'error' ? (
                <Icon name="x-circle" size={22} filled />
              ) : (
                <span className="ek-tx__dot" />
              )}
            </span>
            <div className="ek-tx__text">
              <p className="ek-tx__label">
                {s.label}
                <Sr>{s.state === 'done' ? ', done' : s.state === 'active' ? ', in progress' : s.state === 'error' ? ', failed' : ', not started'}</Sr>
              </p>
              {s.detail ? <p className="ek-tx__detail">{s.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {href ? (
        <a className="ek-link" href={href} target="_blank" rel="noopener noreferrer">
          {hrefLabel}
          <Icon name="arrow-square-out" size={16} />
          <Sr>, opens in a new tab</Sr>
        </a>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ feedback */

const NOTICE_ICON: Record<string, string> = { info: 'info', positive: 'check-circle', caution: 'warning', negative: 'warning-circle', lock: 'lock-simple' };

export function Notice({ tone = 'info', title, children, action, icon }: any) {
  const ic = icon || NOTICE_ICON[tone];
  return (
    <div className={cx('ek-notice', 'ek-notice--' + tone)} role={tone === 'negative' ? 'alert' : undefined}>
      <Icon name={ic} size={20} filled={FILLED.includes(ic)} className="ek-notice__icon" />
      <div className="ek-notice__body">
        {title ? <p className="ek-notice__title">{title}</p> : null}
        {children ? <div className="ek-notice__text">{children}</div> : null}
      </div>
      {action ? <div className="ek-notice__action">{action}</div> : null}
    </div>
  );
}

export function Toast({ tone = 'neutral', children, action, onClose }: any) {
  const ic = tone === 'positive' ? 'check-circle' : tone === 'negative' ? 'warning-circle' : 'info';
  return (
    <div className={cx('ek-toast', 'ek-toast--' + tone)} role="status" aria-live="polite">
      <Icon name={ic} size={20} filled />
      <div className="ek-toast__text">{children}</div>
      {action ? <div className="ek-toast__action">{action}</div> : null}
      {onClose ? (
        <button type="button" className="ek-toast__close" aria-label="Dismiss" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon = 'tag', title, children, action }: any) {
  return (
    <div className="ek-empty">
      <span className="ek-empty__icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="ek-empty__title">{title}</h3>
      {children ? <p className="ek-empty__text">{children}</p> : null}
      {action ? <div className="ek-empty__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius, lines, label = 'Loading' }: any) {
  if (lines) {
    return (
      <div className="ek-skel-lines" role="status" aria-label={label}>
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="ek-skel" style={{ width: i === lines - 1 ? '60%' : '100%', height }} />
        ))}
      </div>
    );
  }
  return <span className="ek-skel" role="status" aria-label={label} style={{ width, height, borderRadius: radius }} />;
}

/* ------------------------------------------------------------------ overlays */

export function Sheet({ open = false, onClose, title, description, children, footer, inline }: any) {
  const ref = React.useRef(null);
  const tid = React.useId();
  React.useEffect(() => {
    const d: any = ref.current;
    if (!d || inline) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, inline]);
  const inner = (
    <div className="ek-sheet__inner">
      <div className="ek-sheet__grab" aria-hidden="true" />
      <header className="ek-sheet__head">
        <h2 className="ek-sheet__title" id={tid}>{title}</h2>
        {onClose ? <IconButton icon="x" label="Close" onClick={onClose} /> : null}
      </header>
      {description ? <p className="ek-sheet__desc">{description}</p> : null}
      <div className="ek-sheet__body">{children}</div>
      {footer ? <footer className="ek-sheet__foot">{footer}</footer> : null}
    </div>
  );
  if (inline) {
    return (
      <div className="ek-sheet ek-sheet--inline" role="dialog" aria-labelledby={tid}>
        {inner}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      className="ek-sheet"
      aria-labelledby={tid}
      onCancel={(e: any) => {
        e.preventDefault();
        onClose && onClose();
      }}
      onClick={(e: any) => {
        if (e.target === ref.current && onClose) onClose();
      }}
    >
      {inner}
    </dialog>
  );
}

/* ------------------------------------------------------------------ navigation */

export function AppBar({ title, subtitle, back, actions }: any) {
  return (
    <header className="ek-appbar">
      {back ? <IconButton icon="caret-left" label={back.label || 'Back'} onClick={back.onClick} /> : null}
      <div className="ek-appbar__titles">
        <h1 className="ek-appbar__title">{title}</h1>
        {subtitle ? <p className="ek-appbar__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ek-appbar__actions">{actions}</div> : null}
    </header>
  );
}

function NavCount({ n }: any) {
  if (!n) return null;
  return (
    <>
      <span className="ek-count" aria-hidden="true">{n}</span>
      <Sr>{`, ${n} waiting`}</Sr>
    </>
  );
}

export function TabBar({ items = [], label = 'Main' }: any) {
  return (
    <nav className="ek-tabbar" aria-label={label}>
      <ul>
        {items.map((it: any) => (
          <li key={it.label}>
            <a href={it.href || '#'} onClick={it.onClick} className={cx('ek-tabbar__item', it.active && 'is-active')} aria-current={it.active ? 'page' : undefined}>
              <span className="ek-tabbar__icon">
                <Icon name={it.icon} size={24} filled={it.active} />
                {it.badge ? <span className="ek-count" aria-hidden="true">{it.badge}</span> : null}
              </span>
              <span className="ek-tabbar__label">{it.label}</span>
              {it.badge ? <Sr>{`, ${it.badge} waiting`}</Sr> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav({ items = [], footer, label = 'Main' }: any) {
  return (
    <nav className="ek-sidenav" aria-label={label}>
      <div className="ek-sidenav__brand">
        <Logo variant="wordmark" className="ek-sidenav__wordmark" />
        <Logo variant="mark" className="ek-sidenav__mark" />
      </div>
      <ul className="ek-sidenav__list">
        {items.map((it: any) => (
          <li key={it.label}>
            <a href={it.href || '#'} onClick={it.onClick} className={cx('ek-sidenav__item', it.active && 'is-active')} aria-current={it.active ? 'page' : undefined}>
              <span className="ek-sidenav__icon">
                <Icon name={it.icon} size={24} filled={it.active} />
              </span>
              <span className="ek-sidenav__label">{it.label}</span>
              <NavCount n={it.badge} />
            </a>
          </li>
        ))}
      </ul>
      {footer ? <div className="ek-sidenav__foot">{footer}</div> : null}
    </nav>
  );
}

export function AppShell({ nav = [], navFooter, children }: any) {
  return (
    <div className="ek-shell">
      <a className="ek-skip" href="#ek-main">Skip to content</a>
      <SideNav items={nav} footer={navFooter} />
      <main className="ek-shell__main" id="ek-main">
        {children}
      </main>
      <TabBar items={nav} />
    </div>
  );
}
