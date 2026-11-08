/**
 * Footer hints component for the command palette.
 * Shows keyboard shortcuts and contextual information.
 */

import { Kbd } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ShortcutBadge } from '../ShortcutBadge';
import type { CommandDefinition } from '../../commands';

interface CommandPaletteFooterProps {
  /** Currently highlighted command */
  selectedCommand: (CommandDefinition & { isAvailable: boolean }) | null;
  /** Total number of matching commands */
  matchCount: number;
}

export function CommandPaletteFooter({ selectedCommand, matchCount }: CommandPaletteFooterProps) {
  const t = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-stroke-subtle bg-surface-secondary/50 text-label text-content-tertiary">
      {/* Left: Action hints */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          <span>{t('commandPalette.footer.run')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↑↓</Kbd>
          <span>{t('commandPalette.footer.navigate')}</span>
        </span>
        <span className="hidden sm:flex items-center gap-1">
          <Kbd>Esc</Kbd>
          <span>{t('common.close')}</span>
        </span>
      </div>

      {/* Right: Selected command info or count */}
      <div className="text-content-secondary">
        {selectedCommand?.shortcut ? (
          <ShortcutBadge
            keys={selectedCommand.shortcut.keys}
            modifier={selectedCommand.shortcut.modifier}
            className="opacity-70"
          />
        ) : (
          <span className="text-content-tertiary">
            {t('commandPalette.footer.commandCount', { count: matchCount })}
          </span>
        )}
      </div>
    </div>
  );
}
