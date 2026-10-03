import {
  ChainMismatchError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  HttpRequestError,
  UserRejectedRequestError,
  type Abi,
  type AbiParameter,
} from 'viem';
import { describe, expect, it } from 'vitest';
import { arcTestnet } from '../chains';
import { earmarkAbi } from '../abi';
import { copy } from '../copy';
import { contractErrorMessage, decodeRevert, describeError } from './errors';

function sample(p: AbiParameter): unknown {
  if (p.type === 'uint8') return 64;
  if (p.type.startsWith('uint')) return 12_345_678n;
  if (p.type === 'address') return '0x3333333333333333333333333333333333333333';
  if (p.type === 'bool') return true;
  if (p.type === 'string') return 'x';
  if (p.type === 'bytes32') return `0x${'00'.repeat(32)}`;
  throw new Error(`no sample for ${p.type}`);
}

/** Wraps revert data the way viem reports a failed write or simulation. */
function reverted(data: `0x${string}`): ContractFunctionExecutionError {
  const cause = new ContractFunctionRevertedError({ abi: earmarkAbi, data, functionName: 'spend' });
  return new ContractFunctionExecutionError(cause, { abi: earmarkAbi, functionName: 'spend', args: [] });
}

type ErrorItem = Extract<(typeof earmarkAbi)[number], { type: 'error' }>;
const contractErrors = earmarkAbi.filter((e): e is ErrorItem => e.type === 'error');

describe('every contract error has a plain message', () => {
  it('covers all errors in the ABI', () => {
    expect(contractErrors.length).toBe(23);
  });

  for (const abiError of contractErrors) {
    it(abiError.name, () => {
      const args = (abiError.inputs as readonly AbiParameter[]).map(sample);
      const abi: Abi = [abiError];
      const data = encodeErrorResult({ abi, errorName: abiError.name, args });
      const decoded = decodeRevert(reverted(data));
      expect(decoded?.name).toBe(abiError.name);
      const message = describeError(reverted(data), { period: 'this week' });
      expect(message).not.toBe(copy.errors.unknown);
      expect(message).toBe(contractErrorMessage(abiError.name, args, { period: 'this week' }));
      expect(message).not.toMatch(/\b(gas|transaction|hash|sponsor|spender|revert)\b/i);
      expect(message.endsWith('.')).toBe(true);
    });
  }
});

describe('messages fill in amounts and dates', () => {
  it('OverLimit names the amount and the period', () => {
    expect(contractErrorMessage('OverLimit', [28_000_000n], { period: 'this week' })).toBe(
      'Only $28.00 is available this week. Ask for approval instead.',
    );
  });

  it('InsufficientBalance names the balance', () => {
    expect(contractErrorMessage('InsufficientBalance', [6_000_000n])).toBe('The pocket only holds $6.00.');
  });

  it('Locked names the date in full', () => {
    const noonUtc = BigInt(Date.UTC(2026, 11, 12, 12) / 1000);
    expect(contractErrorMessage('Locked', [noonUtc])).toBe('This pocket is locked until 12 Dec 2026.');
  });

  it('uses the design-system wording where it exists (D1)', () => {
    expect(contractErrorMessage('PayeeNotApproved', [])).toBe(
      'This pocket only pays approved people. Ask for approval instead.',
    );
    expect(contractErrorMessage('FuelOutOfRange', [])).toBe('The fee credit can be at most $0.50.');
  });
});

describe('wallet and network failures', () => {
  it('maps a wallet rejection', () => {
    const err = new UserRejectedRequestError(new Error('User rejected the request.'));
    expect(describeError(err)).toBe('You cancelled in your wallet. Nothing was sent.');
  });

  it('maps a plain 4001 error from an injected wallet', () => {
    const err = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 });
    expect(describeError(err)).toBe(copy.errors.walletRejected);
  });

  it('maps the wrong network', () => {
    const err = new ChainMismatchError({ chain: arcTestnet, currentChainId: 1 });
    expect(describeError(err)).toBe('Your wallet is on another network. Switch to Arc to continue.');
  });

  it('maps an unreachable RPC', () => {
    const err = new HttpRequestError({ url: 'https://rpc.testnet.arc.io', details: 'Failed to fetch' });
    expect(describeError(err)).toBe('Could not reach Arc. Check your connection and try again.');
  });

  it('maps a USDC compliance block (A6), before and after sending', () => {
    const cause = new ContractFunctionRevertedError({
      abi: earmarkAbi,
      data: encodeErrorResult({
        abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
        errorName: 'Error',
        args: ['Blacklistable: account is blacklisted'],
      }),
      functionName: 'spend',
    });
    const err = new ContractFunctionExecutionError(cause, { abi: earmarkAbi, functionName: 'spend', args: [] });
    expect(describeError(err, { stage: 'preflight' })).toBe('USDC compliance rules block this address. Nothing was sent.');
    expect(describeError(err, { stage: 'onchain' })).toBe(
      'USDC compliance rules stopped this payment. The network fee was still charged.',
    );
  });

  it('never leaves a person without a sentence', () => {
    expect(describeError(new Error('something odd'))).toBe(copy.errors.unknown);
    expect(describeError('not even an error')).toBe(copy.errors.unknown);
  });
});
