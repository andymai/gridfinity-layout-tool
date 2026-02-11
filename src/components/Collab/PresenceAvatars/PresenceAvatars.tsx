/**
 * Main presence UI component.
 *
 * Automatically selects the appropriate variant based on screen size:
 * - Desktop/tablet: PresenceAvatarBar (horizontal avatars with dropdown)
 * - Mobile: PresenceMobileButton (compact button that opens bottom sheet)
 *
 * Returns null when not in collaborative mode or when there are no participants.
 */

import { usePresence } from '@/hooks/usePresence';
import { useResponsive } from '@/shared/hooks';
import { useMobileStore } from '@/core/store/mobile';
import { PresenceAvatarBar } from '../PresenceAvatarBar';
import { PresenceMobileButton } from '../PresenceMobileButton';

interface PresenceAvatarsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders the appropriate presence UI based on screen size.
 */
export function PresenceAvatars({ className = '' }: PresenceAvatarsProps) {
  const { isMobile } = useResponsive();
  const { participants, status, participantCount, isCollaborative } = usePresence();
  const toggleMobilePanel = useMobileStore((state) => state.toggleMobilePanel);

  // Don't render if not in collaborative mode
  if (!isCollaborative) {
    return null;
  }

  // Don't render if no participants (shouldn't happen, but be safe)
  if (participantCount === 0) {
    return null;
  }

  // Mobile: compact button that opens bottom sheet
  if (isMobile) {
    return (
      <PresenceMobileButton
        participantCount={participantCount}
        status={status}
        onPress={() => toggleMobilePanel('participants')}
        className={className}
      />
    );
  }

  // Desktop/tablet: horizontal avatar bar with dropdown
  return <PresenceAvatarBar participants={participants} status={status} className={className} />;
}
