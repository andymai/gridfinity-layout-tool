import { usePresence } from '@/shared/hooks/usePresence';
import { useCollabMode } from '@/shared/hooks/useCollabMode';
import { useTranslation } from '@/i18n';
import { PresenceAvatarList } from '@/shell/Collab/PresenceAvatarList';

/**
 * Participants panel content that safely calls usePresence().
 *
 * Lives in its own module (not inline in MobileLayout) so it can be lazy-loaded:
 * usePresence + PresenceAvatarList pull the Liveblocks client, and collaboration
 * is opt-in. Only mounted when in collaborative mode (inside RoomProvider).
 */
export function ParticipantsPanel() {
  const t = useTranslation();
  const { isCollaborative } = useCollabMode();
  const { participants } = usePresence();

  // Safety check - should not reach here if not collaborative,
  // but guard just in case
  if (!isCollaborative) {
    return (
      <div className="px-4 py-8 text-center text-content-secondary text-sm">
        {t('layout.collaborativeEditingIsNotActive')}
      </div>
    );
  }

  return <PresenceAvatarList participants={participants} className="px-2" />;
}
