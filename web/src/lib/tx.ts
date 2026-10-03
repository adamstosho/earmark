import {
  BaseError,
  erc20Abi,
  WaitForTransactionReceiptTimeoutError,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { getConnection, switchChain, writeContract } from 'wagmi/actions';
import { USDC_ADDRESS } from '../chains';
import { copy } from '../copy';
import type { TxStep } from '../ds/typed';
import type { ArcPublicClient, WagmiConfig } from '../wagmi';
import { describeError, isRejection } from './errors';
import { FALLBACK_GAS, feeCaps, GWEI, withHeadroom } from './gas';
import { isRetryable, withRetry } from './rpc';

// The only write path in the app. For every action it checks the network (and offers to add Arc, US-11), simulates
// the call so nothing that would fail is ever sent, estimates gas plus 20% with a fixed fallback (D7), applies the
// D6 fee caps, waits for the first receipt and treats it as Final (A4), and drives TxStatus through the four states
// in the screen patterns guide: waiting for the wallet, sending, Final, or failed.

export interface ContractCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

export interface TxAction {
  /** Step label in multi-step flows, such as "Allow Earmark to move $30.00 USDC". */
  label: string;
  call: ContractCall;
  fallbackGas: bigint;
  /** Resolves true when the action is not needed (an allowance that already covers the amount). */
  skipIf?: () => Promise<boolean>;
}

export interface FlowSnapshot {
  status: 'running' | 'final' | 'failed';
  steps: TxStep[];
  /** Explorer link for the last receipt. */
  receiptUrl?: string;
  error?: string;
  /** The person cancelled in their wallet. */
  rejected?: boolean;
  receipt?: TransactionReceipt;
}

export interface TxEnv {
  wagmi: WagmiConfig;
  client: ArcPublicClient;
  chainId: number;
  explorer: string;
}

export interface FlowOptions {
  actions: TxAction[];
  /** Last step's label: "Final" by default, "Ready to share" when creating a pocket. */
  finalLabel?: string;
  /** Detail under the last step once done: "This cannot be reversed." for payments. */
  finalDetail?: string;
  /** The pocket's period word, for over-limit messages. */
  period?: string;
  onChange: (snapshot: FlowSnapshot) => void;
}

class FlowError extends Error {
  constructor(
    message: string,
    readonly rejected = false,
  ) {
    super(message);
  }
}

/** An exact-amount USDC approval, skipped when the current allowance already covers the amount. */
export function approvalAction(
  client: ArcPublicClient,
  owner: Address,
  spender: Address,
  amount: bigint,
  label: string,
): TxAction {
  return {
    label,
    call: { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [spender, amount] },
    fallbackGas: FALLBACK_GAS.approve,
    skipIf: async () => {
      const allowance = await withRetry(() =>
        client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] }),
      );
      return allowance >= amount;
    },
  };
}

export async function runFlow(env: TxEnv, opts: FlowOptions): Promise<FlowSnapshot> {
  const { actions } = opts;
  const compact = actions.length === 1;
  const finalLabel = opts.finalLabel ?? copy.tx.final;
  const steps: TxStep[] = compact
    ? [
        { label: copy.tx.confirm, state: 'active' },
        { label: finalLabel, state: 'todo' },
      ]
    : [
        ...actions.map((a, i): TxStep => ({ label: a.label, state: i === 0 ? 'active' : 'todo' })),
        { label: finalLabel, state: 'todo' },
      ];

  let snapshot: FlowSnapshot = { status: 'running', steps };
  const emit = (patch: Partial<FlowSnapshot>) => {
    snapshot = { ...snapshot, ...patch, steps: [...(patch.steps ?? snapshot.steps)] };
    opts.onChange(snapshot);
  };
  const setStep = (i: number, step: Partial<TxStep>) => {
    const next = [...snapshot.steps];
    next[i] = { ...next[i], ...step };
    emit({ steps: next });
  };
  emit({});

  let current = 0;
  try {
    const conn = getConnection(env.wagmi);
    if (!conn.address) throw new FlowError(copy.errors.noWallet);
    const account = conn.address;
    if (conn.chainId !== env.chainId) {
      try {
        await switchChain(env.wagmi, { chainId: env.chainId as WagmiConfig['chains'][number]['id'] });
      } catch (err) {
        throw new FlowError(isRejection(err) ? copy.errors.walletRejected : copy.errors.wrongNetwork, isRejection(err));
      }
    }

    let afterBlock: bigint | undefined;
    let last: TransactionReceipt | undefined;
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      current = compact ? 0 : i;
      if (!compact) setStep(i, { state: 'active', detail: copy.tx.confirm });

      if (action.skipIf && (await action.skipIf())) {
        if (!compact) setStep(i, { state: 'done', detail: copy.tx.alreadyAllowed });
        continue;
      }

      const request = { ...action.call, account, ...(afterBlock !== undefined ? { blockNumber: afterBlock } : {}) };

      // 1. Preflight: a call that would revert is explained and never sent.
      try {
        await withRetry(() => env.client.simulateContract(request));
      } catch (err) {
        throw new FlowError(
          isRetryable(err) ? copy.errors.unreachable : describeError(err, { stage: 'preflight', period: opts.period }),
        );
      }

      // 2. Gas: estimate plus 20%, or the fixed fallback when estimation fails on Arc (A3).
      let gas = action.fallbackGas;
      try {
        gas = withHeadroom(await env.client.estimateContractGas(request));
      } catch {
        gas = action.fallbackGas;
      }

      // 3. Fees (D6) from the latest base fee.
      const block = await withRetry(() => env.client.getBlock({ blockTag: 'latest' }));
      const fees = feeCaps(block.baseFeePerGas ?? 20n * GWEI);

      // 4. The wallet prompt.
      let hash: Hex;
      try {
        hash = await writeContract(env.wagmi, {
          address: action.call.address,
          abi: action.call.abi,
          functionName: action.call.functionName,
          args: action.call.args,
          account,
          chainId: env.chainId as WagmiConfig['chains'][number]['id'],
          gas,
          ...fees,
        });
      } catch (err) {
        throw new FlowError(describeError(err, { stage: 'preflight', period: opts.period }), isRejection(err));
      }

      if (compact) {
        setStep(0, { state: 'done' });
        setStep(1, { state: 'active', detail: copy.tx.sending });
        current = 1;
      } else {
        setStep(i, { detail: copy.tx.sending });
      }
      emit({ receiptUrl: `${env.explorer}/tx/${hash}` });

      // 5. The first receipt is Final: Arc finality is deterministic (A4).
      let receipt: TransactionReceipt;
      try {
        receipt = await env.client.waitForTransactionReceipt({ hash, pollingInterval: 500, timeout: 120_000, retryCount: 20 });
      } catch (err) {
        if (err instanceof WaitForTransactionReceiptTimeoutError) throw new FlowError(copy.tx.stillWaiting);
        throw new FlowError(err instanceof BaseError ? copy.errors.unreachable : copy.errors.unknown);
      }
      if (receipt.status !== 'success') {
        let message: string = copy.errors.failedOnArc;
        try {
          await env.client.simulateContract({ ...request, blockNumber: receipt.blockNumber - 1n });
        } catch (err) {
          message = describeError(err, { stage: 'onchain', period: opts.period });
        }
        throw new FlowError(message);
      }
      afterBlock = receipt.blockNumber;
      last = receipt;
      if (!compact) setStep(i, { state: 'done', detail: copy.tx.final });
    }

    const lastIndex = snapshot.steps.length - 1;
    const doneSteps = [...snapshot.steps];
    doneSteps[lastIndex] = { label: finalLabel, state: 'done', ...(opts.finalDetail ? { detail: opts.finalDetail } : {}) };
    emit({ status: 'final', steps: doneSteps, ...(last ? { receipt: last } : {}) });
    return snapshot;
  } catch (err) {
    const message = err instanceof FlowError ? err.message : describeError(err, { period: opts.period });
    const rejected = err instanceof FlowError ? err.rejected : isRejection(err);
    const failed = [...snapshot.steps];
    failed[current] = { ...failed[current], state: 'error', detail: copy.tx.failed };
    emit({ status: 'failed', steps: failed, error: message, rejected });
    return snapshot;
  }
}
