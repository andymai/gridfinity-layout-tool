/**
 * Footer hints component for the command palette.
 * Shows keyboard shortcuts and contextual information.
 */

import { useTranslation } from '@/i18n';
import { ShortcutBadge } from './ShortcutBadge';
import type { CommandDefinition } from '../commands';

interface CommandPaletteFooterProps {
  /** Currently highlighted command */
  selectedCommand: (CommandDefinition & { isAvailable: boolean }) | null;
  /** Total number of matching commands */
  matchCount: number;
}

export function CommandPaletteFooter({ selectedCommand, matchCount }: CommandPaletteFooterProps) {
  const t = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-stroke-subtle text-xs text-content-tertiary">
      {/* Left: Action hints */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-mono rounded border border-stroke-subtle bg-surface">
            ↵
          </kbd>
          <span>{t('commandPalette.footer.run')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-mono rounded border border-stroke-subtle bg-surface">
            ↑↓
          </kbd>
          <span>{t('commandPalette.footer.navigate')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-mono rounded border border-stroke-subtle bg-surface">
            esc
          </kbd>
          <span>{t('commandPalette.footer.close')}</span>
        </span>
      </div>

      {/* Right: Selected command info or count */}
      <div className="text-content-secondary">
        {selectedCommand?.shortcut ? (
          <ShortcutBadge
            keys={selectedCommand.shortcut.keys}
            modifier={selectedCommand.shortcut.modifier}
            className="opacity-80"
          />
        ) : (
          <span>{t('commandPalette.footer.commandCount', { count: matchCount })}</span>
        )}
      </div>
    </div>
  );
}
