/**
 * Compact presence button for mobile header.
 *
 * Displays participant count with an emoji icon (👥) and
 * connection status indicator. Opens the participants
 * bottom sheet when tapped.
 */

import type { ConnectionStatus } from '@/shared/hooks/usePresence';
import { Button } from '@/design-system';
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
    <Button
      variant="ghost"
      size="sm"
      onClick={onPress}
      className={`gap-1.5 ${className}`.trim()}
      aria-label={t('collab.mobileButton.ariaLabel', { count: participantCount })}
      title={t('collab.mobileButton.title', { count: participantCount })}
    >
      <span className="text-base" aria-hidden="true">
        {PEOPLE_EMOJI}
      </span>

      <span>{participantCount}</span>

      <ConnectionIndicator status={status} size="sm" />
    </Button>
  );
}
