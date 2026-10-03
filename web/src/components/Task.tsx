import type { ReactNode } from 'react';
import { AppBar, Sheet } from '../ds/typed';
import { useIsCompact } from '../lib/viewport';

interface TaskProps {
  title: string;
  backLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  /** Shown under the sheet title from 600px. */
  description?: string;
}

/**
 * A focused task (Pay, Ask, Add money, New pocket): a full screen with only a back button below 600px, and a Sheet
 * from 600px (screen patterns guide, D9). The route or state that opened it stays the same either way.
 */
export function Task({ title, backLabel, onClose, footer, children, description }: TaskProps) {
  const compact = useIsCompact();
  if (compact) {
    return (
      <div className="app-task">
        <AppBar title={title} back={{ label: backLabel, onClick: onClose }} />
        <main className="app-task__body" id="ek-main">
          {children}
        </main>
        {footer ? <div className="app-task__foot">{footer}</div> : null}
      </div>
    );
  }
  return (
    <Sheet open title={title} onClose={onClose} footer={footer} {...(description ? { description } : {})}>
      {children}
    </Sheet>
  );
}
