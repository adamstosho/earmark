import { useState } from 'react';
import { zeroAddress, type Address as Addr } from 'viem';
import { earmarkAbi } from '../abi';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import {
  Address,
  AmountInput,
  Button,
  Keypad,
  Notice,
  PocketIcon,
  SegmentedControl,
  TextField,
  applyKey,
} from '../ds/typed';
import { usePayees } from '../data/hooks';
import type { PocketView } from '../data/pockets';
import { parseUsdc, toDisplay, usd } from '../lib/amounts';
import { hueName, iconName } from '../lib/appearance';
import { FALLBACK_GAS } from '../lib/gas';
import { displayName, savedName, setName, useNames } from '../lib/names';
import { byteLength, clampBytes, parseAddress, sameAddress } from '../lib/text';
import { useIsCompact } from '../lib/viewport';
import { TxPanel, useFlow } from './Flow';
import { periodWord } from './Pockets';
import { useNairaRate, useWallet } from './System';
import { Task } from './Task';

const OTHER = 'other';

/** Pay within the rules, or ask for approval (US-03, US-04). A task screen on phones, a Sheet from 600px. */
export function PayOrAskSheet({
  pocket,
  initialMode,
  onClose,
}: {
  pocket: PocketView;
  initialMode: 'pay' | 'ask';
  onClose: () => void;
}) {
  const env = useEnv();
  const names = useNames();
  const rate = useNairaRate();
  const compact = useIsCompact();
  const { address } = useWallet();
  const payees = usePayees(pocket.id);
  const flow = useFlow();

  const requestOnly = pocket.limit === 0n;
  const [mode, setMode] = useState<'pay' | 'ask'>(requestOnly ? 'ask' : initialMode);
  const [value, setValue] = useState('');
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');
  const [otherName, setOtherName] = useState('');
  const [otherTouched, setOtherTouched] = useState(false);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);

  const list = payees.data ?? [];
  const chosen = choice === '' && list.length === 1 && pocket.payeeOnly ? list[0] ?? '' : choice;
  const recipient: Addr | null = chosen === OTHER ? parseAddress(other) : chosen !== '' ? (chosen as Addr) : null;
  const badFormat = chosen === OTHER && otherTouched && other.trim() !== '' && parseAddress(other) === null;
  const forbidden = recipient !== null && (recipient === zeroAddress || sameAddress(recipient, env.config.pockets));
  const inList = recipient !== null && list.some((a) => sameAddress(a, recipient));

  const amount = parseUsdc(value);
  const over = mode === 'pay' && amount !== null && amount > pocket.available;
  const notApproved = mode === 'pay' && pocket.payeeOnly && recipient !== null && !inList;
  const mustAsk = mode === 'pay' && (over || notApproved);
  const notYours = address !== undefined && !sameAddress(address, pocket.spender);
  const ready = amount !== null && amount > 0n && recipient !== null && !forbidden && !notYours;

  const title = mode === 'pay' ? copy.pay.payTitle(pocket.label) : copy.pay.askTitle(pocket.label);
  const sponsorName = savedName(names, pocket.sponsor);

  const submit = () => {
    if (!ready) return;
    if (chosen === OTHER && otherName.trim() !== '') setName(recipient, otherName);
    const asking = mode === 'ask' || mustAsk;
    void flow.run({
      actions: [
        {
          label: asking ? copy.pay.askForApproval : copy.pay.modePay,
          call: {
            address: env.config.pockets,
            abi: earmarkAbi,
            functionName: asking ? 'request' : 'spend',
            args: [pocket.id, recipient, amount, note],
          },
          fallbackGas: asking ? FALLBACK_GAS.request : FALLBACK_GAS.spend,
        },
      ],
      period: periodWord(pocket),
      ...(asking ? {} : { finalDetail: copy.tx.finalPayment }),
      successToast: asking ? copy.pay.asked(usd(amount), pocket.label) : copy.pay.paid(usd(amount), pocket.label),
    });
  };

  const buttonLabel =
    amount === null || amount === 0n
      ? copy.pay.enterAmount
      : recipient === null
        ? copy.pay.choose
        : mustAsk
          ? copy.pay.askForApproval
          : mode === 'pay'
            ? copy.pay.payButton(usd(amount))
            : copy.pay.askButton(usd(amount));

  const footer = flow.snap ? (
    flow.running ? null : (
      <Button variant="primary" size="lg" block onClick={flow.final ? onClose : flow.reset}>
        {flow.final ? copy.tx.done : copy.system.tryAgain}
      </Button>
    )
  ) : (
    <Button variant="primary" size="lg" block disabled={!ready} iconStart={mustAsk || mode === 'ask' ? 'hand-coins' : 'arrow-up-right'} onClick={submit}>
      {buttonLabel}
    </Button>
  );

  if (flow.snap) {
    return (
      <Task title={title} backLabel={copy.pay.back} onClose={onClose} footer={footer}>
        <TxPanel snap={flow.snap} />
      </Task>
    );
  }

  const payeePicker = (
    <fieldset className="app-fieldset app-stack-sm">
      <legend className="ek-type-label">{copy.pay.choosePayee}</legend>
      <div className="app-list">
        {list.map((a) => (
          <label key={a} className="app-choice">
            <input
              type="radio"
              name="payee"
              value={a}
              checked={sameAddress(chosen, a)}
              onChange={() => {
                setChoice(a);
                setPicking(false);
              }}
              onClick={() => setPicking(false)}
            />
            <span className="app-choice__box" aria-hidden="true" />
            <span className="app-grow ek-type-body">{displayName(names, a)}</span>
          </label>
        ))}
        <label className="app-choice">
          <input type="radio" name="payee" value={OTHER} checked={chosen === OTHER} onChange={() => setChoice(OTHER)} />
          <span className="app-choice__box" aria-hidden="true" />
          <span className="app-grow ek-type-body">{copy.pay.otherAddress}</span>
        </label>
      </div>
      {chosen === OTHER ? (
        <div className="app-stack-sm">
          <TextField
            label={copy.pay.addressLabel}
            value={other}
            mono
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
            onChange={(e) => setOther(e.target.value)}
            onBlur={() => setOtherTouched(true)}
            hint={copy.pay.addressHint}
            {...(badFormat ? { error: copy.errors.badAddressFormat } : forbidden ? { error: copy.errors.invalidAddress } : {})}
          />
          <TextField
            label={copy.pay.saveName}
            value={otherName}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setOtherName(e.target.value)}
          />
        </div>
      ) : null}
      {compact && recipient !== null && !forbidden ? (
        <div>
          <Button variant="secondary" onClick={() => setPicking(false)}>
            {copy.tx.done}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );

  const payeeRow = (
    <div className="app-payee">
      <PocketIcon icon="user" size="sm" />
      <div className="app-grow">
        <p className="ek-type-label-sm app-muted">{copy.pay.payTo}</p>
        {recipient ? (
          savedName(names, recipient) ? (
            <p className="ek-type-body">{savedName(names, recipient)}</p>
          ) : (
            <Address value={recipient} copy={false} />
          )
        ) : (
          <p className="ek-type-body app-muted">{copy.pay.choosePayee}</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
        {recipient ? copy.pay.change : copy.pay.chooseShort}
      </Button>
    </div>
  );

  const noteField = (
    <TextField
      label={copy.pay.noteLabel}
      value={note}
      autoComplete="off"
      enterKeyHint="done"
      onChange={(e) => setNote(clampBytes(e.target.value, 64))}
      hint={`${copy.pay.noteHint} ${copy.pay.noteCount(byteLength(note))}`}
    />
  );

  const notices = (
    <>
      {notYours ? <Notice tone="negative">{copy.pay.notYours}</Notice> : null}
      {notApproved ? <Notice tone="caution">{copy.pay.notApproved}</Notice> : null}
      {mode === 'ask' || mustAsk ? (
        <p className="ek-type-body-sm app-muted">
          {requestOnly ? `${copy.pay.requestOnly} ` : ''}
          {sponsorName ? copy.pay.askLede(sponsorName) : copy.pay.askLedeAnon}
        </p>
      ) : null}
    </>
  );

  const modeSwitch = requestOnly ? null : (
    <SegmentedControl
      label={copy.pay.modeLabel}
      block
      value={mode}
      onChange={(v) => setMode(v === 'ask' ? 'ask' : 'pay')}
      options={[
        { value: 'pay', label: copy.pay.modePay },
        { value: 'ask', label: copy.pay.modeAsk },
      ]}
    />
  );

  const amountInput = (
    <AmountInput
      label={copy.pay.amount}
      value={value}
      onChange={setValue}
      readOnly={compact}
      autoFocus={!compact}
      {...(rate !== undefined ? { rate } : {})}
      {...(mode === 'pay' ? { available: toDisplay(pocket.available), availableLabel: copy.pay.available } : {})}
    />
  );

  if (compact) {
    return (
      <Task title={title} backLabel={copy.pay.back} onClose={onClose} footer={footer}>
        {picking ? (
          payeePicker
        ) : (
          <>
            {modeSwitch}
            {amountInput}
            {payeeRow}
            {notices}
            {noteField}
            <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />
          </>
        )}
      </Task>
    );
  }

  return (
    <Task title={title} backLabel={copy.pay.back} onClose={onClose} footer={footer}>
      <div className="app-pockethead">
        <PocketIcon icon={iconName(pocket.icon)} hue={hueName(pocket.hue)} size="sm" />
        <span className="ek-type-heading-sm">{pocket.label}</span>
      </div>
      {modeSwitch}
      {amountInput}
      {payeePicker}
      {notices}
      {noteField}
    </Task>
  );
}
