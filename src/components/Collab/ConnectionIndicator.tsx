/**
 * Connection status indicator component.
 *
 * Displays a colored dot indicating the current connection status:
 * - Green (connected): Normal operation
 * - Yellow (reconnecting): Attempting to reconnect, animated pulse
 * - Blue (connecting): Initial connection, animated pulse
 * - Red (disconnected): Connection lost
 */

import type { ConnectionStatus } from '@/hooks/usePresence';

interface ConnectionIndicatorProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/** Status-specific styling */
const STATUS_STYLES: Record<
  ConnectionStatus,
  { bg: string; label: string; animate: boolean }
> = {
  connected: {
    bg: 'bg-success',
    label: 'Connected',
    animate: false,
  },
  reconnecting: {
    bg: 'bg-warning',
    label: 'Reconnecting...',
    animate: true,
  },
  connecting: {
    bg: 'bg-info',
    label: 'Connecting...',
    animate: true,
  },
  disconnected: {
    bg: 'bg-error',
    label: 'Disconnected',
    animate: false,
  },
};

/** Size-specific dimensions */
const SIZE_STYLES: Record<'sm' | 'md', string> = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
};

/**
 * Renders a status indicator dot with appropriate color and animation.
 */
export function ConnectionIndicator({
  status,
  size = 'sm',
  className = '',
}: ConnectionIndicatorProps) {
  const { bg, label, animate } = STATUS_STYLES[status];
  const sizeClass = SIZE_STYLES[size];

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizeClass}
        ${bg}
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `.trim()}
      role="status"
      aria-label={label}
      title={label}
    />
  );
}
