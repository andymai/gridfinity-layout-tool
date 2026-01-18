/**
 * Full participant list component.
 *
 * Displays all participants in a vertical list with avatars and names.
 * Reused in both the desktop dropdown and mobile bottom sheet.
 */

import type { Participant } from '@/hooks/usePresence';
import { PresenceAvatar } from './PresenceAvatar';

interface PresenceAvatarListProps {
  /** List of participants to display */
  participants: Participant[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a vertical list of all participants.
 */
export function PresenceAvatarList({
  participants,
  className = '',
}: PresenceAvatarListProps) {
  if (participants.length === 0) {
    return (
      <div className={`text-sm text-content-secondary py-2 ${className}`}>
        No one else is here yet
      </div>
    );
  }

  return (
    <ul
      className={`space-y-1 ${className}`}
      role="list"
      aria-label="Participants"
    >
      {participants.map((participant) => (
        <li
          key={participant.id}
          className={`
            flex items-center gap-3 px-2 py-1.5 rounded-md
            ${participant.isSelf ? 'bg-surface-hover' : ''}
          `.trim()}
        >
          <PresenceAvatar
            participant={participant}
            size="md"
            showName={false}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-content truncate">
                {participant.name}
              </span>
              {participant.isSelf && (
                <span className="text-xs text-content-tertiary">(you)</span>
              )}
              {participant.isOwner && (
                <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                  Owner
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
