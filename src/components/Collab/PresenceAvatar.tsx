/**
 * Individual avatar component for presence display.
 *
 * Renders a circular avatar with:
 * - Colored background (from participant's assigned color)
 * - Initials derived from participant name
 * - Crown icon overlay for owner
 * - Ring highlight for self
 * - Optional name text display
 */

import { memo } from 'react';
import type { Participant } from '@/hooks/usePresence';
import { getInitials } from '@/hooks/usePresence';

interface PresenceAvatarProps {
  /** Participant data */
  participant: Participant;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the name label next to avatar */
  showName?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

/** Size-specific dimensions */
const SIZE_CONFIG: Record<'sm' | 'md' | 'lg', { container: string; text: string; crown: string }> =
  {
    sm: {
      container: 'w-6 h-6',
      text: 'text-[10px]',
      crown: 'w-2.5 h-2.5 -top-0.5 -right-0.5',
    },
    md: {
      container: 'w-8 h-8',
      text: 'text-xs',
      crown: 'w-3 h-3 -top-0.5 -right-0.5',
    },
    lg: {
      container: 'w-10 h-10',
      text: 'text-sm',
      crown: 'w-3.5 h-3.5 -top-1 -right-1',
    },
  };

/**
 * Crown SVG icon for owner badge.
 */
function CrownIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Owner">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}

/**
 * Renders a participant avatar with optional name display.
 */
export const PresenceAvatar = memo(function PresenceAvatar({
  participant,
  size = 'md',
  showName = false,
  className = '',
}: PresenceAvatarProps) {
  const { name, color, isOwner, isSelf } = participant;
  const initials = getInitials(name);
  const config = SIZE_CONFIG[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Avatar circle */}
      <div className="relative inline-block">
        <div
          className={`
            ${config.container}
            rounded-full
            flex items-center justify-center
            font-medium text-white
            ${isSelf ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''}
          `.trim()}
          style={{ backgroundColor: color }}
          title={isSelf ? `${name} (you)` : name}
          aria-label={isSelf ? `${name} (you)` : name}
        >
          <span className={config.text}>{initials}</span>
        </div>

        {/* Crown badge for owner */}
        {isOwner && (
          <div
            className={`absolute ${config.crown} bg-warning rounded-full flex items-center justify-center`}
            aria-hidden="true"
          >
            <CrownIcon className="w-2/3 h-2/3 text-warning-foreground" />
          </div>
        )}
      </div>

      {/* Name label */}
      {showName && (
        <span className="text-sm text-content truncate max-w-[120px]">
          {name}
          {isSelf && <span className="text-content-tertiary ml-1">(you)</span>}
        </span>
      )}
    </div>
  );
});
