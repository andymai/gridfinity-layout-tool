import type { SyncState } from '@/core/sync/status';

interface SyncRingProps {
  state: SyncState | 'none';
  initial: string;
  size?: number;
}

export function SyncRing({ state, initial, size = 28 }: SyncRingProps) {
  const ring = ringLayer(state);

  return (
    <span
      aria-hidden="true"
      className="relative inline-block flex-none"
      style={{ width: size, height: size }}
    >
      <span
        className={ring.className}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          ...ring.style,
        }}
      />
      <span
        className="absolute inline-flex items-center justify-center rounded-full bg-primary-muted text-content text-[11px] font-medium"
        style={{ inset: 2 }}
      >
        {initial}
      </span>
    </span>
  );
}

interface RingLayer {
  className: string;
  style: React.CSSProperties;
}

function ringLayer(state: SyncState | 'none'): RingLayer {
  switch (state) {
    case 'syncing':
      return {
        className: 'animate-sync-ring-spin',
        style: {
          background:
            'conic-gradient(from 0deg, var(--color-info) 0deg, var(--color-info) 90deg, transparent 270deg, var(--color-info) 360deg)',
        },
      };
    case 'offline':
      return {
        className: '',
        style: {
          border: '2px dashed var(--color-warning)',
          background: 'transparent',
        },
      };
    case 'error':
      return {
        className: 'animate-sync-ring-breath',
        style: { background: 'var(--color-error)' },
      };
    case 'none':
      return {
        className: '',
        style: { border: '1.5px solid var(--color-stroke-subtle)' },
      };
    case 'idle':
    default:
      return {
        className: '',
        style: { background: 'var(--color-success)' },
      };
  }
}
