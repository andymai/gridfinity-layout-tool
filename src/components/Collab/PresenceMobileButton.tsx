/**
 * Compact presence button for mobile header.
 *
 * Displays participant count with an emoji icon (👥) and
 * connection status indicator. Opens the participants
 * bottom sheet when tapped.
 */

import type { ConnectionStatus } from '../../hooks/usePresence';
import { ConnectionIndicator } from './ConnectionIndicator';

interface PresenceMobileButtonProps {
  /** Total participant count */
  participantCount: number;
  /** Current connection status */
  status: ConnectionStatus;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a compact presence indicator for mobile.
 */
export function PresenceMobileButton({
  participantCount,
  status,
  onPress,
  className = '',
}: PresenceMobileButtonProps) {
  return (
    <button
      onClick={onPress}
      className={`
        flex items-center gap-1.5 px-2 py-1
        rounded-md text-sm font-medium
        text-content-secondary hover:text-content
        hover:bg-surface-hover transition-colors
        ${className}
      `.trim()}
      aria-label={`${participantCount} collaborators - tap to see all`}
      title={`${participantCount} collaborators`}
    >
      {/* People emoji */}
      <span className="text-base" aria-hidden="true">
        👥
      </span>

      {/* Count */}
      <span>{participantCount}</span>

      {/* Connection indicator */}
      <ConnectionIndicator status={status} size="sm" />
    </button>
  );
}
