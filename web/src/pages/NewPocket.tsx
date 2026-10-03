import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseEventLogs, zeroAddress, type Address as Addr } from 'viem';
import { earmarkAbi } from '../abi';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import {
  AmountInput,
  Button,
  Icon,
  IconButton,
  Notice,
  PocketIcon,
  SegmentedControl,
  Switch,
  TextField,
  formatUSDC,
} from '../ds/typed';
import { useUsdcBalance } from '../data/hooks';
import { PERIOD_SECONDS } from '../data/pockets';
import { minBig, parseUsdc, usd } from '../lib/amounts';
import { defaultHueFor, POCKET_HUES, POCKET_ICONS, hueName, iconName } from '../lib/appearance';
import { endOfDayUnix, fromUnix, fullDate, toDateInput } from '../lib/dates';
import { FALLBACK_GAS, GWEI, TYPICAL_GAS } from '../lib/gas';
import { displayName, getNames, setName, useNames } from '../lib/names';
import { absoluteLink, navigate, paths } from '../lib/router';
import { useNow } from '../lib/clock';
import { withRetry } from '../lib/rpc';
import { byteLength, clampBytes, hasWideCharacters, parseAddress, sameAddress } from '../lib/text';
import { approvalAction } from '../lib/tx';
import { TxPanel, useFlow } from '../components/Flow';
import { plainAmount } from '../components/Sheets';
import { copyText, familyLink, shareLink, useNairaRate, useWallet } from '../components/System';
import { Task } from '../components/Task';

type PeriodChoice = 'day' | 'week' | 'month';

const MIN_FEE = 50_000n;
const MAX_FEE = 500_000n;
const MAX_CAP = 1_000_000n;
const TWO_YEARS = 730 * 86_400;

/** Suggests an icon from the name, until the sender picks one themselves. */
const KEYWORDS: [RegExp, number][] = [
  [/school|fee|tuition|book|uniform|exam|ile-?iwe|makaranta|akwukwo/i, 0],
  [/food|rice|grocer|meal|ounje|abinci|nri/i, 1],
  [/rent|house|home|ile\b|gida|ulo/i, 2],
  [/emergen|health|hospital|medic|drug|clinic/i, 3],
  [/light|electric|power|nepa|prepaid/i, 4],
  [/airtime|data|phone|recharge/i, 5],
  [/transport|bus|fare|fuel|keke|okada|taxi/i, 6],
  [/market|shop|store/i, 7],
  [/gift|church|mosque|giving|tithe|wedding|birthday/i, 8],
  [/sav|future|reserve/i, 9],
];

interface Payee {
  address: Addr;
  name: string;
}

/** New pocket (/#/new, US-01): a task screen on phones, a sheet over the dashboard from 600px. */
export function NewPocket() {
  const env = useEnv();
  const names = useNames();
  const rate = useNairaRate();
  const { address } = useWallet();
  const balance = useUsdcBalance(address);
  const flow = useFlow();

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(1);
  const [hue, setHue] = useState(0);
  const [iconPicked, setIconPicked] = useState(false);
  const [hueTouched, setHueTouched] = useState(false);
  const [spenderInput, setSpenderInput] = useState('');
  const [spenderName, setSpenderName] = useState('');
  const [period, setPeriod] = useState<PeriodChoice>('week');
  const [limitInput, setLimitInput] = useState('');
  const [requestOnly, setRequestOnly] = useState(false);
  const [payeeOnly, setPayeeOnly] = useState(false);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [payeeInput, setPayeeInput] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [payeeError, setPayeeError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockDate, setLockDate] = useState('');
  const [more, setMore] = useState(false);
  const [feeInput, setFeeInput] = useState('0.05');
  const [depositInput, setDepositInput] = useState('');
  const [tried, setTried] = useState(false);

  const baseFee = useQuery({
    queryKey: ['basefee'],
    queryFn: async () => (await withRetry(() => env.client.getBlock({ blockTag: 'latest' }))).baseFeePerGas ?? 20n * GWEI,
    staleTime: 30_000,
  });

  const onLabel = (value: string) => {
    const next = clampBytes(value, 32);
    setLabel(next);
    if (!iconPicked) {
      const match = KEYWORDS.find(([re]) => re.test(next));
      if (match) {
        setIcon(match[1]);
        if (!hueTouched) setHue(defaultHueFor(match[1]) ?? 0);
      }
    }
  };

  // ---------------------------------------------------------------- validation
  const trimmedLabel = label.trim();
  const spender = parseAddress(spenderInput);
  const limit = requestOnly ? 0n : parseUsdc(limitInput);
  const fee = more ? parseUsdc(feeInput) : MIN_FEE;
  const deposit = depositInput.trim() === '' ? 0n : parseUsdc(depositInput);
  const lockUntil = locked ? endOfDayUnix(lockDate) : 0n;
  const nowMs = useNow();
  const now = Math.floor(nowMs / 1000);

  const errors = {
    label: trimmedLabel === '' ? copy.create.nameEmpty : null,
    spender:
      spender === null
        ? copy.errors.badAddressFormat
        : spender === zeroAddress || sameAddress(spender, env.config.pockets)
          ? copy.errors.invalidAddress
          : null,
    limit: limit === null || (!requestOnly && limit === 0n) ? copy.create.limitEmpty : null,
    payees: payeeOnly && payees.length === 0 ? copy.create.payeesNeeded : null,
    lock:
      locked && (lockUntil === null || Number(lockUntil) <= now + 60 || Number(lockUntil) > now + TWO_YEARS - 600)
        ? copy.create.lockInvalid
        : null,
    fee: fee === null || (fee !== 0n && (fee < MIN_FEE || fee > MAX_FEE)) ? copy.create.feeInvalid : null,
    deposit:
      deposit === null
        ? copy.errors.invalidAmount
        : balance.data !== undefined && deposit > balance.data
          ? copy.add.notEnough(usd(balance.data))
          : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (e: string | null) => (tried && e ? { error: e } : {});

  const knownName = spenderName.trim() || (spender ? displayName(names, spender) : '');
  const spenderLabel = knownName || copy.family.someone;
  const periodKind = period;
  const feeValue = fee ?? MIN_FEE;

  const networkFee = useMemo(() => {
    if (baseFee.data === undefined) return null;
    const gas =
      (deposit !== null && deposit > 0n ? TYPICAL_GAS.approve : 0n) +
      TYPICAL_GAS.createPocketBase +
      TYPICAL_GAS.perPayee * BigInt(payeeOnly ? payees.length : 0);
    return Number(formatUnits(gas * (baseFee.data + GWEI), 18));
  }, [baseFee.data, deposit, payeeOnly, payees.length]);

  // ---------------------------------------------------------------- payees
  const addPayee = () => {
    const a = parseAddress(payeeInput);
    if (a === null || a === zeroAddress || sameAddress(a, env.config.pockets)) {
      setPayeeError(copy.errors.badAddressFormat);
      return;
    }
    if (payees.some((p) => sameAddress(p.address, a))) {
      setPayeeError(copy.create.payeeDuplicate);
      return;
    }
    if (payees.length >= 10) {
      setPayeeError(copy.create.payeesMax);
      return;
    }
    setPayees([...payees, { address: a, name: payeeName.trim() }]);
    setPayeeInput('');
    setPayeeName('');
    setPayeeError(null);
  };

  // ---------------------------------------------------------------- submit
  const submit = () => {
    setTried(true);
    if (!valid || !address || spender === null || limit === null || lockUntil === null || deposit === null || fee === null) return;
    if (spenderName.trim() !== '') setName(spender, spenderName);
    for (const p of payees) if (p.name !== '') setName(p.address, p.name);
    const params = {
      spender,
      label: trimmedLabel,
      limitPerPeriod: limit,
      periodLength: PERIOD_SECONDS[period],
      lockUntil,
      payeeOnly,
      fuelTarget: fee,
      fuelCapPerPeriod: minBig(fee * 2n, MAX_CAP),
      deposit,
      icon,
      hue,
    };
    const create = {
      label: copy.create.createStep,
      call: {
        address: env.config.pockets,
        abi: earmarkAbi,
        functionName: 'createPocket',
        args: [params, payeeOnly ? payees.map((p) => p.address) : []],
      },
      fallbackGas: FALLBACK_GAS.createPocket,
    };
    void flow.run({
      actions:
        deposit > 0n
          ? [approvalAction(env.client, address, env.config.pockets, deposit, copy.create.allowStep(plainAmount(deposit))), create]
          : [{ ...create }],
      finalLabel: copy.create.readyStep,
      successToast: copy.create.done,
    });
  };

  const close = () => navigate(paths.send);

  // ---------------------------------------------------------------- after the tap
  if (flow.snap) {
    const created = flow.snap.receipt
      ? parseEventLogs({ abi: earmarkAbi, logs: flow.snap.receipt.logs, eventName: 'PocketCreated' })[0]
      : undefined;
    const newId = created?.args.pocketId;
    const footer = flow.running ? null : flow.final && newId !== undefined ? (
      <Button variant="primary" size="lg" block iconEnd="arrow-right" onClick={() => navigate(paths.pocket(newId))}>
        {copy.create.openPocket}
      </Button>
    ) : (
      <Button variant="primary" size="lg" block onClick={flow.final ? close : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    );
    return (
      <Task title={copy.create.title} backLabel={copy.create.back} onClose={close} footer={footer}>
        {flow.final ? (
          <div className="ek-stack">
            <Notice tone="positive" title={copy.create.doneTitle}>
              {copy.create.doneBody(getNames()[spender?.toLowerCase() ?? ''] ?? spenderLabel)}
            </Notice>
            <div className="app-stack-sm">
              <p className="ek-type-label">{copy.create.familyLink}</p>
              <div className="app-linkbox">
                <span className="app-grow ek-type-mono">{familyLink()}</span>
                <IconButton icon="copy" label={copy.create.copyFamily} onClick={() => void copyText(familyLink())} />
                <IconButton icon="share-network" label={copy.create.share} onClick={() => void shareLink(familyLink(), copy.appName)} />
              </div>
            </div>
            {newId !== undefined ? (
              <div className="app-stack-sm">
                <p className="ek-type-label">{copy.create.publicLink}</p>
                <div className="app-linkbox">
                  <span className="app-grow ek-type-mono">{absoluteLink(paths.view(newId))}</span>
                  <IconButton icon="copy" label={copy.toast.copied} onClick={() => void copyText(absoluteLink(paths.view(newId)))} />
                </div>
              </div>
            ) : null}
            <TxPanel snap={flow.snap} />
          </div>
        ) : (
          <TxPanel snap={flow.snap} />
        )}
      </Task>
    );
  }

  // ---------------------------------------------------------------- the form
  const savedEntries = Object.entries(names).slice(0, 6);
  const lockMin = toDateInput(new Date(nowMs + 86_400_000));
  const lockMax = toDateInput(new Date((now + TWO_YEARS - 86_400) * 1000));

  const footer = (
    <>
      {tried && !valid ? <p className="ek-type-body-sm app-muted" role="alert">{copy.create.fixErrors}</p> : null}
      <Button variant="primary" size="lg" block iconStart="plus" onClick={submit}>
        {copy.create.button}
      </Button>
    </>
  );

  return (
    <Task title={copy.create.title} backLabel={copy.create.back} onClose={close} footer={footer}>
      <div className="app-form app-reading">
        {/* 1. Name, icon and colour */}
        <div className="app-group">
          <TextField
            label={copy.create.nameLabel}
            value={label}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => onLabel(e.target.value)}
            hint={`${copy.create.nameHint}${hasWideCharacters(label) ? ` ${copy.create.nameAccents}` : ''} ${byteLength(label)} / 32`}
            {...show(errors.label)}
          />
          <div className="app-stack-sm">
            <p className="ek-type-label" id="icon-label">
              {copy.create.iconLabel}
            </p>
            <div className="app-picker" role="radiogroup" aria-labelledby="icon-label">
              {POCKET_ICONS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={icon === i}
                  aria-label={copy.icons[name] ?? name}
                  title={copy.icons[name] ?? name}
                  className="app-pick"
                  onClick={() => {
                    setIcon(i);
                    setIconPicked(true);
                    if (!hueTouched) setHue(defaultHueFor(i) ?? hue);
                  }}
                >
                  <PocketIcon icon={name} hue={hueName(hue)} size="sm" />
                </button>
              ))}
            </div>
          </div>
          <div className="app-stack-sm">
            <p className="ek-type-label" id="hue-label">
              {copy.create.hueLabel}
            </p>
            <div className="app-picker" role="radiogroup" aria-labelledby="hue-label">
              {POCKET_HUES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={hue === i}
                  aria-label={copy.hues[name] ?? name}
                  title={copy.hues[name] ?? name}
                  className="app-pick"
                  onClick={() => {
                    setHue(i);
                    setHueTouched(true);
                  }}
                >
                  <span className="app-swatch" data-hue={name} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Who can spend */}
        <div className="app-group">
          <h3 className="ek-type-heading-sm">{copy.create.whoTitle}</h3>
          <TextField
            label={copy.create.whoLabel}
            value={spenderInput}
            mono
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="0x"
            onChange={(e) => setSpenderInput(e.target.value)}
            hint={copy.create.whoHint}
            {...show(errors.spender)}
          />
          {savedEntries.length > 0 ? (
            <div className="app-stack-sm">
              <p className="ek-type-label-sm app-muted">{copy.create.savedNames}</p>
              <div className="app-row">
                {savedEntries.map(([a, n]) => (
                  <Button
                    key={a}
                    variant="tonal"
                    size="sm"
                    iconStart="user"
                    onClick={() => {
                      setSpenderInput(a);
                      setSpenderName(n);
                    }}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <TextField
            label={copy.create.nicknameLabel}
            value={spenderName}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => setSpenderName(e.target.value)}
            hint={copy.create.nicknameHint}
          />
        </div>

        {/* 3. Allowance */}
        <div className="app-group">
          <h3 className="ek-type-heading-sm">{copy.create.allowanceTitle}</h3>
          <SegmentedControl
            label={copy.create.periodLabel}
            block
            value={period}
            onChange={(v) => setPeriod(v === 'day' || v === 'month' ? v : 'week')}
            options={[...copy.period.options]}
          />
          {!requestOnly ? (
            <TextField
              label={copy.period.limitLabel(periodKind)}
              value={limitInput}
              prefix="$"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0.00"
              onChange={(e) => setLimitInput(e.target.value.replace(/[^0-9.]/g, ''))}
              hint={
                knownName
                  ? copy.create.limitHint(knownName, copy.period.each(periodKind))
                  : copy.create.limitHintAnon(copy.period.each(periodKind))
              }
              {...show(errors.limit)}
            />
          ) : null}
          <Switch label={copy.create.requestOnly} description={copy.create.requestOnlyDesc} checked={requestOnly} onChange={setRequestOnly} />
        </div>

        {/* 4. Rules */}
        <div className="app-group">
          <h3 className="ek-type-heading-sm">{copy.create.rulesTitle}</h3>
          <Switch label={copy.create.payeeOnly} description={copy.create.payeeOnlyDesc} checked={payeeOnly} onChange={setPayeeOnly} />
          {payeeOnly ? (
            <div className="app-stack-sm">
              {payees.length > 0 ? (
                <ul className="app-list" aria-label={copy.pocket.payees}>
                  {payees.map((p) => (
                    <li key={p.address}>
                      <Icon name="user" size={20} />
                      <span className="app-grow ek-type-body">{p.name || displayName(names, p.address)}</span>
                      <IconButton
                        icon="x"
                        label={copy.create.removePayee(p.name || displayName(names, p.address))}
                        onClick={() => setPayees(payees.filter((x) => x.address !== p.address))}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {payees.length < 10 ? (
                <>
                  <TextField
                    label={copy.create.payeeAddress}
                    value={payeeInput}
                    mono
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="0x"
                    onChange={(e) => setPayeeInput(e.target.value)}
                    {...(payeeError ? { error: payeeError } : tried && errors.payees ? { error: errors.payees } : {})}
                  />
                  <TextField
                    label={copy.create.payeeName}
                    value={payeeName}
                    autoComplete="off"
                    onChange={(e) => setPayeeName(e.target.value)}
                  />
                  <div>
                    <Button variant="secondary" iconStart="plus" onClick={addPayee}>
                      {copy.create.addPayee}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="ek-type-body-sm app-muted">{copy.create.payeesMax}</p>
              )}
            </div>
          ) : null}
          <Switch label={copy.create.lockLabel} description={copy.create.lockDesc} checked={locked} onChange={setLocked} />
          {locked ? (
            <TextField
              label={copy.create.lockDate}
              type="date"
              value={lockDate}
              min={lockMin}
              max={lockMax}
              onChange={(e) => setLockDate(e.target.value)}
              hint={copy.create.lockHint}
              {...show(errors.lock)}
            />
          ) : null}
        </div>

        {/* 5. Fee credit */}
        <div className="app-group">
          <h3 className="ek-type-heading-sm">{copy.create.feeTitle}</h3>
          <p className="ek-type-body-sm app-muted">
            {feeValue > 0n
              ? knownName
                ? copy.create.feeLine(usd(feeValue), knownName)
                : copy.create.feeLineAnon(usd(feeValue))
              : copy.create.feeOff}
          </p>
          <div>
            <button type="button" className="app-plain ek-type-label" aria-expanded={more} onClick={() => setMore(!more)}>
              <Icon name={more ? 'caret-down' : 'caret-right'} size={16} />
              {more ? copy.create.fewerOptions : copy.create.moreOptions}
            </button>
          </div>
          {more ? (
            <TextField
              label={copy.create.feeLabel}
              value={feeInput}
              prefix="$"
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => setFeeInput(e.target.value.replace(/[^0-9.]/g, ''))}
              hint={copy.create.feeHint}
              {...show(errors.fee)}
            />
          ) : null}
        </div>

        {/* 6. Money to add now */}
        <div className="app-group">
          <AmountInput
            label={copy.create.depositLabel}
            value={depositInput}
            onChange={setDepositInput}
            {...(rate !== undefined ? { rate } : {})}
            {...(tried && errors.deposit ? { error: errors.deposit } : {})}
          />
          {balance.data !== undefined ? (
            <p className="ek-type-body-sm app-muted app-center">{copy.add.yourBalance(usd(balance.data))}</p>
          ) : null}
        </div>

        {/* 7. Summary */}
        <section className="app-card" aria-labelledby="summary">
          <div className="app-pockethead">
            <PocketIcon icon={iconName(icon)} hue={hueName(hue)} />
            <h3 id="summary" className="ek-type-heading-md">
              {trimmedLabel ? (knownName ? copy.create.summaryFor(trimmedLabel, knownName) : trimmedLabel) : copy.create.summaryTitle}
            </h3>
          </div>
          <ul className="app-rules ek-type-body-sm">
            <li>
              <Icon name="calendar-blank" size={20} />
              <span>
                {requestOnly
                  ? copy.create.summaryRequestOnly
                  : limit === null || limit === 0n
                    ? copy.create.summaryNoLimit
                    : copy.create.summaryLimit(usd(limit), copy.period.each(periodKind))}
              </span>
            </li>
            <li>
              <Icon name="users-three" size={20} />
              <span>{payeeOnly ? copy.create.summaryPayees(payees.length) : copy.create.summaryAnyPayee}</span>
            </li>
            <li className={locked && lockUntil ? 'is-lock' : undefined}>
              <Icon name={locked ? 'lock-simple' : 'lock-simple-open'} size={20} />
              <span>
                {locked && lockUntil ? copy.create.summaryLock(fullDate(fromUnix(lockUntil))) : copy.create.summaryNoLock}
              </span>
            </li>
            <li>
              <Icon name="arrow-down-left" size={20} />
              <span>{deposit && deposit > 0n ? copy.create.summaryAdd(usd(deposit)) : copy.create.summaryAddNothing}</span>
            </li>
            {networkFee !== null ? (
              <li>
                <Icon name="receipt" size={20} />
                <span>{copy.create.summaryFees(formatUSDC(Math.max(networkFee, 0.01)))}</span>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </Task>
  );
}
