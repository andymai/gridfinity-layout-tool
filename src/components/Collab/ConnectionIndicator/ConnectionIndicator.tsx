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
import { useTranslation } from '@/i18n';

interface ConnectionIndicatorProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/** Status-specific styling (non-translatable) */
const STATUS_STYLES: Record<ConnectionStatus, { bg: string; animate: boolean }> = {
  connected: { bg: 'bg-success', animate: false },
  reconnecting: { bg: 'bg-warning', animate: true },
  connecting: { bg: 'bg-info', animate: true },
  disconnected: { bg: 'bg-error', animate: false },
};

/** Translation keys for status labels */
const STATUS_LABEL_KEYS: Record<ConnectionStatus, string> = {
  connected: 'collab.connected',
  reconnecting: 'collab.reconnecting',
  connecting: 'collab.connecting',
  disconnected: 'collab.disconnected',
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
  const t = useTranslation();
  const { bg, animate } = STATUS_STYLES[status];
  const label = t(STATUS_LABEL_KEYS[status]);
  const sizeClass = SIZE_STYLES[size];

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizeClass}
        ${bg}
        ${animate ? 'animate-pulse motion-reduce:animate-none' : ''}
        ${className}
      `.trim()}
      role="status"
      aria-label={label}
      title={label}
    />
  );
}
