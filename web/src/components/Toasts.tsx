import { useEffect, useRef, useState } from 'react';
import { Toast } from '../ds/typed';
import { dismissToast, useToasts, type ToastItem } from '../lib/toasts';

const SHOW_MS = 5_000;

/** One toast, about five seconds, paused while hovered or focused (Toast README, accessibility guide). */
function TimedToast({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(SHOW_MS);
  const started = useRef(0);

  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const timer = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started.current;
    };
  }, [paused, item.id]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Toast tone={item.tone} onClose={() => dismissToast(item.id)}>
        {item.message}
      </Toast>
    </div>
  );
}

export function Toasts() {
  const items = useToasts();
  return (
    <div className="ek-toasts">
      {items.map((t) => (
        <TimedToast key={t.id} item={t} />
      ))}
    </div>
  );
}
