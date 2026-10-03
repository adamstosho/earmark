import { useState } from 'react';
import { earmarkAbi } from '../abi';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import { Address, AmountInput, Button, Keypad, Money, Notice, Sheet, TextField, applyKey } from '../ds/typed';
import { useUsdcBalance } from '../data/hooks';
import type { PocketView, RequestView } from '../data/pockets';
import { parseUsdc, toDisplay, toInput, usd } from '../lib/amounts';
import { endOfDayUnix, fromUnix, fullDate, toDateInput } from '../lib/dates';
import { useNow } from '../lib/clock';
import { FALLBACK_GAS } from '../lib/gas';
import { displayName, savedName, useNames } from '../lib/names';
import { sameAddress } from '../lib/text';
import { approvalAction } from '../lib/tx';
import { useIsCompact } from '../lib/viewport';
import { formatUSDC } from '../ds/typed';
import { TxPanel, useFlow } from './Flow';
import { isLocked, periodWord } from './Pockets';
import { useNairaRate, useWallet } from './System';
import { Task } from './Task';

/** "30.00" for step labels such as "Allow Earmark to move 30.00 USDC" (the unit is named once). */
export function plainAmount(value: bigint): string {
  return formatUSDC(toDisplay(value)).replace('$', '');
}

/** Amount entry: keypad on phones, typed from 600px (Keypad README). */
export function AmountEntry({
  value,
  onChange,
  label,
  available,
  availableLabel,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  available?: bigint;
  availableLabel?: string;
  error?: string | null;
}) {
  const compact = useIsCompact();
  const rate = useNairaRate();
  return (
    <>
      <AmountInput
        label={label}
        value={value}
        onChange={onChange}
        readOnly={compact}
        autoFocus={!compact}
        {...(rate !== undefined ? { rate } : {})}
        {...(available !== undefined ? { available: toDisplay(available) } : {})}
        {...(availableLabel ? { availableLabel } : {})}
        {...(error ? { error } : {})}
      />
      {compact ? <Keypad onKey={(k) => onChange(applyKey(value, k))} /> : null}
    </>
  );
}

/** Add money: from the sender, or from a co-funder on the public page (US-02, D11). */
export function AddMoneyTask({ pocket, onClose }: { pocket: PocketView; onClose: () => void }) {
  const env = useEnv();
  const { address } = useWallet();
  const names = useNames();
  const balance = useUsdcBalance(address);
  const flow = useFlow();
  const [value, setValue] = useState('');
  const amount = parseUsdc(value);
  const short = amount !== null && balance.data !== undefined && amount > balance.data;
  const coFunder = address !== undefined && !sameAddress(address, pocket.sponsor);

  const submit = () => {
    if (!address || amount === null || amount === 0n) return;
    void flow.run({
      actions: [
        approvalAction(env.client, address, env.config.pockets, amount, copy.add.allowStep(plainAmount(amount))),
        {
          label: copy.add.step,
          call: { address: env.config.pockets, abi: earmarkAbi, functionName: 'fund', args: [pocket.id, amount] },
          fallbackGas: FALLBACK_GAS.fund,
        },
      ],
      successToast: copy.add.done(usd(amount), pocket.label),
    });
  };

  const footer = flow.snap ? (
    flow.running ? null : (
      <Button variant="primary" size="lg" block onClick={flow.final ? onClose : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    )
  ) : (
    <Button variant="primary" size="lg" block disabled={!amount || short} onClick={submit}>
      {amount ? copy.add.button(usd(amount)) : copy.add.enter}
    </Button>
  );

  return (
    <Task title={copy.add.title(pocket.label)} backLabel={copy.pocket.back} onClose={onClose} footer={footer}>
      {flow.snap ? (
        <TxPanel snap={flow.snap} />
      ) : (
        <>
          {coFunder ? (
            <Notice tone="caution" title={copy.add.coFunderTitle}>
              {copy.add.coFunder(displayName(names, pocket.sponsor))}
            </Notice>
          ) : null}
          <AmountEntry
            value={value}
            onChange={setValue}
            label={copy.add.amount}
            error={short ? copy.add.notEnough(usd(balance.data)) : null}
          />
          {balance.data !== undefined && !short ? (
            <p className="ek-type-body-sm app-muted app-center">{copy.add.yourBalance(usd(balance.data))}</p>
          ) : null}
        </>
      )}
    </Task>
  );
}

/** Take money back (US-08). Taking the whole balance asks once more, restating the effect. */
export function TakeBackSheet({ pocket, onClose }: { pocket: PocketView; onClose: () => void }) {
  const env = useEnv();
  const names = useNames();
  const { address } = useWallet();
  const flow = useFlow();
  const [value, setValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const amount = parseUsdc(value);
  const over = amount !== null && amount > pocket.balance;
  const all = amount !== null && amount === pocket.balance;
  const locked = isLocked(pocket);

  const submit = () => {
    if (!address || amount === null || amount === 0n || over) return;
    if (all && !confirming) {
      setConfirming(true);
      return;
    }
    void flow.run({
      actions: [
        {
          label: copy.pocket.takeBack,
          call: { address: env.config.pockets, abi: earmarkAbi, functionName: 'withdraw', args: [pocket.id, amount, address] },
          fallbackGas: FALLBACK_GAS.withdraw,
        },
      ],
      successToast: copy.takeBack.done(usd(amount), pocket.label),
    });
  };

  const footer = flow.snap ? (
    flow.running ? null : (
      <Button variant="primary" onClick={flow.final ? onClose : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    )
  ) : (
    <>
      <Button variant="secondary" onClick={confirming ? () => setConfirming(false) : onClose}>
        {copy.tx.close}
      </Button>
      <Button variant="primary" disabled={!amount || over || locked} onClick={submit}>
        {amount ? copy.takeBack.button(usd(amount)) : copy.add.enter}
      </Button>
    </>
  );

  return (
    <Sheet open title={confirming ? copy.takeBack.confirmTitle : copy.takeBack.title(pocket.label)} onClose={onClose} footer={footer}>
      {flow.snap ? (
        <TxPanel snap={flow.snap} />
      ) : locked ? (
        <Notice tone="lock" title={copy.pocket.lockTitle(fullDate(fromUnix(pocket.lockUntil)))}>
          {copy.takeBack.locked(fullDate(fromUnix(pocket.lockUntil)))}
        </Notice>
      ) : confirming && amount !== null ? (
        <p className="ek-type-body">
          {copy.takeBack.confirmBody(usd(amount), displayName(names, pocket.spender), pocket.label)}
        </p>
      ) : (
        <>
          <AmountInput
            label={copy.takeBack.amount}
            value={value}
            onChange={setValue}
            autoFocus
            available={toDisplay(pocket.balance)}
            availableLabel={copy.pocket.inPocket}
          />
          <div className="app-row">
            <Button variant="ghost" onClick={() => setValue(toInput(pocket.balance))}>
              {copy.takeBack.all}
            </Button>
          </div>
          {address ? <Address label={copy.takeBack.to} value={address} copy={false} /> : null}
        </>
      )}
    </Sheet>
  );
}

const TWO_YEARS = 730 * 86_400;

/** Move the lock date later, never earlier (US-08). */
export function MoveLockSheet({ pocket, onClose }: { pocket: PocketView; onClose: () => void }) {
  const env = useEnv();
  const flow = useFlow();
  const current = fromUnix(pocket.lockUntil);
  const [value, setValue] = useState('');
  const newLock = endOfDayUnix(value);
  const nowMs = useNow();
  const now = Math.floor(nowMs / 1000);
  const tooEarly = newLock !== null && newLock <= pocket.lockUntil;
  const tooLate = newLock !== null && Number(newLock) > now + TWO_YEARS - 600;
  const minDate = new Date(Math.max(current.getTime(), nowMs) + 86_400_000);
  const maxDate = new Date((now + TWO_YEARS - 86_400) * 1000);
  const label = newLock !== null ? fullDate(fromUnix(newLock)) : '';

  const submit = () => {
    if (newLock === null || tooEarly || tooLate) return;
    void flow.run({
      actions: [
        {
          label: copy.pocket.moveLock,
          call: { address: env.config.pockets, abi: earmarkAbi, functionName: 'extendLock', args: [pocket.id, newLock] },
          fallbackGas: FALLBACK_GAS.extendLock,
        },
      ],
      successToast: copy.lock.done(label),
    });
  };

  const footer = flow.snap ? (
    flow.running ? null : (
      <Button variant="primary" onClick={flow.final ? onClose : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    )
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {copy.tx.close}
      </Button>
      <Button variant="primary" disabled={newLock === null || tooEarly || tooLate} onClick={submit}>
        {newLock !== null && !tooEarly && !tooLate ? copy.lock.button(label) : copy.lock.choose}
      </Button>
    </>
  );

  return (
    <Sheet open title={copy.lock.title} onClose={onClose} footer={footer}>
      {flow.snap ? (
        <TxPanel snap={flow.snap} />
      ) : (
        <TextField
          label={copy.lock.field}
          type="date"
          value={value}
          min={toDateInput(minDate)}
          max={toDateInput(maxDate)}
          onChange={(e) => setValue(e.target.value)}
          hint={copy.lock.hint(fullDate(current))}
          {...(tooEarly ? { error: copy.lock.tooEarly } : tooLate ? { error: copy.lock.tooLate } : {})}
        />
      )}
    </Sheet>
  );
}

/** Approve and pay, or decline, one request (US-05, US-06). */
export function DecisionSheet({
  request,
  pocket,
  mode,
  onClose,
}: {
  request: RequestView;
  pocket: PocketView;
  mode: 'approve' | 'decline';
  onClose: () => void;
}) {
  const env = useEnv();
  const names = useNames();
  const rate = useNairaRate();
  const flow = useFlow();
  const approving = mode === 'approve';
  const short = approving && request.amount > pocket.balance;

  const submit = () => {
    void flow.run({
      actions: [
        {
          label: approving ? copy.requests.approveTitle : copy.requests.declineTitle,
          call: {
            address: env.config.pockets,
            abi: earmarkAbi,
            functionName: approving ? 'approveRequest' : 'declineRequest',
            args: [request.id],
          },
          fallbackGas: approving ? FALLBACK_GAS.approveRequest : FALLBACK_GAS.declineRequest,
        },
      ],
      period: periodWord(pocket),
      ...(approving ? { finalDetail: copy.tx.finalPayment } : {}),
      successToast: approving ? copy.requests.approved(usd(request.amount)) : copy.requests.declined,
    });
  };

  const footer = flow.snap ? (
    flow.running ? null : (
      <Button variant="primary" onClick={flow.final ? onClose : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    )
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {copy.tx.close}
      </Button>
      <Button variant="primary" iconStart={approving ? 'check' : 'x'} disabled={short} onClick={submit}>
        {approving ? copy.requests.approveButton(usd(request.amount)) : copy.requests.declineTitle}
      </Button>
    </>
  );

  return (
    <Sheet open title={approving ? copy.requests.approveTitle : copy.requests.declineTitle} onClose={onClose} footer={footer}>
      {flow.snap ? (
        <TxPanel snap={flow.snap} />
      ) : (
        <>
          <Money value={toDisplay(request.amount)} size="lg" {...(rate !== undefined ? { rate } : {})} />
          {request.memo ? <p className="ek-type-body">{copy.activity.note(request.memo)}</p> : null}
          <Address label={copy.pay.payTo} value={request.to} copy={false} />
          <p className="ek-type-body-sm app-muted">
            {savedName(names, request.to) ? `${savedName(names, request.to) ?? ''} · ${pocket.label}` : pocket.label}
          </p>
          {short ? (
            <Notice tone="negative">{copy.errors.insufficientBalance(usd(pocket.balance))}</Notice>
          ) : approving ? (
            <p className="ek-type-body-sm app-muted">{copy.tx.finalPayment}</p>
          ) : (
            <p className="ek-type-body-sm app-muted">{copy.requests.declineHint(pocket.label)}</p>
          )}
        </>
      )}
    </Sheet>
  );
}
