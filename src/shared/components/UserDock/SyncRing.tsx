import type { SyncState } from '@/core/sync/status';

interface SyncRingProps {
  /** What the ring should communicate. 'none' renders a neutral border (used
   *  for the anonymous sign-in state, where there's no sync to report). */
  state: SyncState | 'none';
  /** Single grapheme rendered inside the ring. */
  initial: string;
  /** Outer diameter in px. Default matches the dock row height. */
  size?: number;
}

/**
 * Avatar with a status ring whose color and motion encode sync state:
 *   idle    — solid green ring, static
 *   syncing — conic-gradient ring, rotating (1.2s linear)
 *   offline — dashed amber ring, static
 *   error   — solid red ring, slow opacity breath (2s)
 *   none    — neutral border (used for anonymous state)
 */
export function SyncRing({ state, initial, size = 28 }: SyncRingProps) {
  const innerInset = 2;
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
        style={{ inset: innerInset }}
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
