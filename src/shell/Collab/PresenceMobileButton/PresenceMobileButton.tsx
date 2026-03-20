/**
 * Compact presence button for mobile header.
 *
 * Displays participant count with an emoji icon (👥) and
 * connection status indicator. Opens the participants
 * bottom sheet when tapped.
 */

import type { ConnectionStatus } from '@/shared/hooks/usePresence';
import { useTranslation } from '@/i18n';

const PEOPLE_EMOJI = '👥';
import { ConnectionIndicator } from '../ConnectionIndicator';

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
  const t = useTranslation();
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
      aria-label={t('collab.mobileButton.ariaLabel', { count: participantCount })}
      title={t('collab.mobileButton.title', { count: participantCount })}
    >
      {/* People emoji */}
      <span className="text-base" aria-hidden="true">
        {PEOPLE_EMOJI}
      </span>

      {/* Count */}
      <span>{participantCount}</span>

      {/* Connection indicator */}
      <ConnectionIndicator status={status} size="sm" />
    </button>
  );
}
