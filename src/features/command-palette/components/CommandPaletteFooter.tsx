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

/** Footer keyboard key styling - smaller variant for hints */
const footerKeyClasses =
  'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 text-[10px] font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content-tertiary shadow-[0_1px_0_1px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]';

export function CommandPaletteFooter({ selectedCommand, matchCount }: CommandPaletteFooterProps) {
  const t = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-stroke-subtle bg-surface-secondary/50 text-[11px] text-content-tertiary">
      {/* Left: Action hints */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className={footerKeyClasses}>↵</kbd>
          <span>{t('commandPalette.footer.run')}</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className={footerKeyClasses}>↑↓</kbd>
          <span>{t('commandPalette.footer.navigate')}</span>
        </span>
        <span className="hidden sm:flex items-center gap-1">
          <kbd className={footerKeyClasses}>esc</kbd>
          <span>{t('commandPalette.footer.close')}</span>
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
