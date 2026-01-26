/**
 * Shortcut badge component displaying keyboard keys.
 * Shows platform-appropriate modifier (⌘ on Mac, Ctrl on Windows/Linux).
 */

import { useMemo } from 'react';

interface ShortcutBadgeProps {
  keys: string | string[];
  modifier?: boolean;
  className?: string;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
const modKey = isMac ? '⌘' : 'Ctrl';

export function ShortcutBadge({ keys, modifier, className = '' }: ShortcutBadgeProps) {
  const keyArray = useMemo(() => {
    if (Array.isArray(keys)) return keys;
    return [keys];
  }, [keys]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {modifier && (
        <>
          <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-mono rounded bg-surface border border-stroke-subtle text-content-secondary">
            {modKey}
          </kbd>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="text-content-tertiary text-xs">+</span>
        </>
      )}
      {keyArray.map((key, index) => (
        <span key={key} className="flex items-center gap-1">
          {}
          {index > 0 && <span className="text-content-tertiary text-xs">/</span>}
          <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-mono rounded bg-surface border border-stroke-subtle text-content-secondary">
            {key}
          </kbd>
        </span>
      ))}
    </div>
  );
}
