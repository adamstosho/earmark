import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import { Notice, TxStatus } from '../ds/typed';
import { showToast } from '../lib/toasts';
import { runFlow, type FlowOptions, type FlowSnapshot } from '../lib/tx';

export interface RunOptions extends Omit<FlowOptions, 'onChange'> {
  /** Toast shown once Final, even if the sheet was closed meanwhile. */
  successToast?: string;
}

/** Runs a flow through lib/tx.ts and keeps its snapshot for TxStatus. */
export function useFlow() {
  const env = useEnv();
  const queryClient = useQueryClient();
  const [snap, setSnap] = useState<FlowSnapshot | null>(null);

  const run = useCallback(
    async (opts: RunOptions): Promise<FlowSnapshot> => {
      const { successToast, ...flow } = opts;
      const result = await runFlow(env.tx, { ...flow, onChange: setSnap });
      if (result.status === 'final') {
        await queryClient.invalidateQueries({ queryKey: ['earmark'] });
        if (successToast) showToast(successToast);
      }
      return result;
    },
    [env, queryClient],
  );

  return {
    snap,
    run,
    reset: () => setSnap(null),
    running: snap?.status === 'running',
    final: snap?.status === 'final',
    failed: snap?.status === 'failed',
  };
}

/** TxStatus through to Final with a receipt link, and the failure explained in one sentence. */
export function TxPanel({ snap, title }: { snap: FlowSnapshot; title?: string }) {
  const showReceipt = snap.status !== 'running' && snap.receiptUrl;
  return (
    <div className="ek-stack">
      <TxStatus
        {...(title ? { title } : {})}
        steps={snap.steps}
        {...(showReceipt && snap.receiptUrl ? { href: snap.receiptUrl, hrefLabel: copy.tx.receipt } : {})}
      />
      {snap.status === 'failed' && snap.error ? (
        snap.rejected ? (
          <Notice tone="info">{snap.error}</Notice>
        ) : (
          <Notice tone="negative" title={copy.tx.failed}>
            {snap.error}
          </Notice>
        )
      ) : null}
    </div>
  );
}
