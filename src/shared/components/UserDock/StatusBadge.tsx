import { cn } from '@/design-system/cn';
import type { SyncState } from '@/core/sync/status';

interface StatusBadgeProps {
  state: SyncState;
  size?: number;
}

const STATE_CLASS: Record<SyncState, string> = {
  idle: 'bg-success',
  syncing: 'bg-info animate-status-syncing motion-reduce:animate-none',
  offline: 'bg-warning',
  error: 'bg-error animate-status-error motion-reduce:animate-none',
};

export function StatusBadge({ state, size = 28 }: StatusBadgeProps) {
  const dot = Math.max(8, Math.round(size * 0.36));
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute rounded-full ring-2 ring-[var(--color-surface-secondary)]',
        STATE_CLASS[state]
      )}
      style={{ width: dot, height: dot, right: -1, bottom: -1 }}
    />
  );
}
