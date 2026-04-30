/**
 * Shortcut badge component displaying keyboard keys.
 * Shows platform-appropriate modifier (⌘ on Mac, Ctrl on Windows/Linux).
 * Styled to match HelpModal keyboard keys with gradient and shadow for depth.
 */

import { useMemo } from 'react';

interface ShortcutBadgeProps {
  keys: string | string[];
  modifier?: boolean;
  shift?: boolean;
  className?: string;
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';

/** Keyboard key styling matching HelpModal */
const keyClasses =
  'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content-secondary shadow-[0_1px_0_1px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]';

export function ShortcutBadge({ keys, modifier, shift, className = '' }: ShortcutBadgeProps) {
  const keyArray = useMemo(() => {
    if (Array.isArray(keys)) return keys;
    return [keys];
  }, [keys]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {modifier && (
        <>
          <kbd className={keyClasses}>{modKey}</kbd>
          {/* eslint-disable-next-line i18next/no-literal-string -- keyboard shortcut joiner glyph, not translatable */}
          <span className="text-content-tertiary text-[10px]">+</span>
        </>
      )}
      {shift && (
        <>
          <kbd className={keyClasses}>Shift</kbd>
          {/* eslint-disable-next-line i18next/no-literal-string -- keyboard shortcut joiner glyph, not translatable */}
          <span className="text-content-tertiary text-[10px]">+</span>
        </>
      )}
      {keyArray.map((key, index) => (
        <span key={`${key}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span className="text-content-tertiary text-[10px] mx-0.5">/</span>}
          <kbd className={keyClasses}>{key}</kbd>
        </span>
      ))}
    </div>
  );
}
