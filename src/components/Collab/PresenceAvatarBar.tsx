/**
 * Horizontal avatar bar for desktop/tablet header.
 *
 * Shows up to MAX_VISIBLE_AVATARS avatars inline, with a "+N more"
 * button that opens a dropdown with the full participant list.
 * Includes a connection status indicator.
 */

import { useState, useRef } from 'react';
import type { Participant, ConnectionStatus } from '@/hooks/usePresence';
import { PresenceAvatar } from './PresenceAvatar';
import { ConnectionIndicator } from './ConnectionIndicator';
import { PresenceDropdown } from './PresenceDropdown';

/** Maximum number of avatars to show inline */
const MAX_VISIBLE_AVATARS = 5;

interface PresenceAvatarBarProps {
  /** List of participants */
  participants: Participant[];
  /** Current connection status */
  status: ConnectionStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a horizontal bar of participant avatars with overflow handling.
 */
export function PresenceAvatarBar({
  participants,
  status,
  className = '',
}: PresenceAvatarBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleParticipants = participants.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, participants.length - MAX_VISIBLE_AVATARS);
  const hasOverflow = overflowCount > 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Connection status indicator */}
      <ConnectionIndicator status={status} size="md" />

      {/* Avatar stack */}
      <div
        ref={containerRef}
        className="flex items-center"
        role="list"
        aria-label={`${participants.length} collaborators`}
      >
        {/* Visible avatars - overlapping stack */}
        <div className="flex items-center -space-x-2">
          {visibleParticipants.map((participant) => (
            <div
              key={participant.id}
              className="ring-2 ring-surface-secondary rounded-full"
              role="listitem"
            >
              <PresenceAvatar
                participant={participant}
                size="sm"
                showName={false}
              />
            </div>
          ))}
        </div>

        {/* Overflow button or click target */}
        <button
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className={`
            ml-1 px-2 py-1 rounded-md text-xs font-medium
            transition-colors
            ${isDropdownOpen
              ? 'bg-surface-hover text-content'
              : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }
          `.trim()}
          aria-expanded={isDropdownOpen}
          aria-haspopup="dialog"
          title={`${participants.length} collaborators - click to see all`}
        >
          {hasOverflow ? `+${overflowCount} more` : `${participants.length}`}
        </button>
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <PresenceDropdown
          participants={participants}
          status={status}
          triggerRef={containerRef}
          onClose={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}
