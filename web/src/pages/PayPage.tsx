import { copy } from '../copy';
import { Button, EmptyState } from '../ds/typed';
import { usePocket } from '../data/hooks';
import { navigate, paths } from '../lib/router';
import { useIsCompact } from '../lib/viewport';
import { PayOrAskSheet } from '../components/PayOrAskSheet';
import { PocketCardSkeleton } from '../components/Pockets';
import { LoadError } from '../components/System';
import { FamilyHome } from './FamilyHome';

/** Pay or Ask (/#/family/pay/:id and /#/family/ask/:id): linkable, a task screen on phones, a sheet from 600px. */
export function PayPage({ id, mode }: { id: bigint; mode: 'pay' | 'ask' }) {
  const compact = useIsCompact();
  const pocket = usePocket(id);
  const close = () => navigate(paths.family);

  let task;
  if (pocket.isPending) {
    task = compact ? (
      <div className="ek-page">
        <PocketCardSkeleton />
      </div>
    ) : null;
  } else if (pocket.isError && !pocket.data) {
    task = (
      <div className="ek-page">
        <LoadError onRetry={() => void pocket.refetch()} />
      </div>
    );
  } else if (!pocket.data) {
    task = (
      <div className="ek-page">
        <EmptyState
          icon="magnifying-glass"
          title={copy.pocket.notFoundTitle}
          action={
            <Button variant="primary" onClick={close}>
              {copy.pocket.goHome}
            </Button>
          }
        >
          {copy.pocket.notFoundBody}
        </EmptyState>
      </div>
    );
  } else {
    task = <PayOrAskSheet key={`${id}-${mode}`} pocket={pocket.data} initialMode={mode} onClose={close} />;
  }

  if (compact) return task;
  return (
    <>
      <FamilyHome />
      {task}
    </>
  );
}
