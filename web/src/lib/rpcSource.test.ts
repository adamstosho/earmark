import { describe, expect, it } from 'vitest';
import { RpcRequestError } from 'viem';
import { rpcLogSource } from './activity';

const ADDRESS = '0x68C480758172bBC94858B98F6E5E356FA30e3080';
const rateLimit = () => new RpcRequestError({ body: {}, url: 'test', error: { code: -32005, message: 'rate limit exceeded' } });
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('rpcLogSource', () => {
  it('reads at most three blocks at once', async () => {
    let running = 0;
    let peak = 0;
    const source = rpcLogSource(async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return [{ address: ADDRESS }];
    }, ADDRESS);
    await Promise.all(Array.from({ length: 10 }, (_, i) => source.logsInBlock(BigInt(100 + i), 1n)));
    expect(peak).toBe(3);
  });

  it('shares identical reads and remembers a block that held events', async () => {
    let calls = 0;
    const source = rpcLogSource(async () => {
      calls++;
      await tick();
      return [{ address: ADDRESS }];
    }, ADDRESS);
    await Promise.all([source.logsInBlock(500n, 1n), source.logsInBlock(500n, 1n)]);
    expect(calls).toBe(1);
    await source.logsInBlock(500n, 1n);
    expect(calls).toBe(1);
    await source.logsInBlock(500n, 2n);
    expect(calls).toBe(2);
  });

  it('does not remember an empty answer, which can come from a lagging backend', async () => {
    let calls = 0;
    const source = rpcLogSource(() => {
      calls++;
      return Promise.resolve([]);
    }, ADDRESS);
    await source.logsInBlock(7n, 1n);
    await source.logsInBlock(7n, 1n);
    expect(calls).toBe(2);
  });

  it('retries a rate-limited read instead of failing the feed', async () => {
    let calls = 0;
    const source = rpcLogSource(() => {
      calls++;
      return calls < 3 ? Promise.reject(rateLimit()) : Promise.resolve([{ address: ADDRESS }]);
    }, ADDRESS);
    await expect(source.logsInBlock(900n, 1n)).resolves.toHaveLength(1);
    expect(calls).toBe(3);
  });
});
