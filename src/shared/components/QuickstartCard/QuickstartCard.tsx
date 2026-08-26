/**
 * One-time orientation card shell shared by tool first-run experiences
 * (bin designer, baseplate generator).
 *
 * Non-modal: floats over the bottom-right of the host page, never traps
 * focus, and dismisses on the button or Escape. The host owns the flag
 * state, row content, and any auto-dismiss-on-edit behavior.
 */

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Button } from '@/design-system';

export interface QuickstartRow {
  readonly icon: ReactNode;
  readonly text: string;
}

interface QuickstartCardProps {
  readonly titleId: string;
  readonly title: string;
  readonly rows: readonly QuickstartRow[];
  readonly dismissLabel: string;
  readonly onDismiss: (method: 'got_it' | 'escape') => void;
}

export function QuickstartCard({
  titleId,
  title,
  rows,
  dismissLabel,
  onDismiss,
}: QuickstartCardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss('escape');
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onDismiss]);

  return (
    <div
      className="absolute bottom-4 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stroke-subtle bg-surface-elevated shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="region"
      aria-labelledby={titleId}
    >
      <div className="p-4 space-y-3">
        <h3 id={titleId} className="text-sm font-semibold text-content">
          {title}
        </h3>

        {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
        <ul className="space-y-2 list-none" role="list">
          {rows.map((row, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-accent/70" aria-hidden="true">
                {row.icon}
              </div>
              <span className="text-xs text-content-secondary leading-relaxed">{row.text}</span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={() => onDismiss('got_it')}
          className="px-3 py-1.5 text-xs font-semibold"
        >
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
