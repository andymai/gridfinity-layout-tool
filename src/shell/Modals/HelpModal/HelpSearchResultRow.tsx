/**
 * Renders one row in the unified Help search results list. Branches on
 * entry kind: shortcuts get the existing key-cap rendering; features get a
 * "Go to" deep-link button; tips render description-only.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { HelpEntry } from '@/shared/help/helpEntry';
import { ShortcutBadge } from '@/shared/components/ShortcutBadge';
import { jumpToHelpTarget } from '@/shared/help/helpJumpDispatcher';

interface HelpSearchResultRowProps {
  entry: HelpEntry;
  onJump: () => void;
  /**
   * Whether to render the Go-to deep-link button on feature entries.
   * Defaults to true; mobile suppresses it until mobile surfaces expose
   * data-help-target attributes (planned follow-up).
   */
  showJumpButton?: boolean;
}

export function HelpSearchResultRow({
  entry,
  onJump,
  showJumpButton = true,
}: HelpSearchResultRowProps) {
  const t = useTranslation();
  const title = t(entry.titleKey);
  const description = entry.titleKey === entry.descriptionKey ? null : t(entry.descriptionKey);

  return (
    <div className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-content">{title}</span>
          <KindBadge kind={entry.kind} />
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-content-tertiary line-clamp-2">{description}</p>
        )}
      </div>
      {entry.kind === 'shortcut' ? (
        <ShortcutBadge
          keys={entry.keys}
          modifier={entry.modifier}
          shift={entry.shift}
          className="shrink-0"
        />
      ) : entry.kind === 'feature' && showJumpButton ? (
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            onJump();
            void jumpToHelpTarget(entry.target);
          }}
        >
          {t('help.goTo')}
        </Button>
      ) : null}
    </div>
  );
}

function KindBadge({ kind }: { kind: HelpEntry['kind'] }) {
  const t = useTranslation();
  const label =
    kind === 'shortcut'
      ? t('help.kind.shortcut')
      : kind === 'feature'
        ? t('help.kind.feature')
        : t('help.kind.tip');
  return (
    <span className="text-micro uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-elevated text-content-tertiary">
      {label}
    </span>
  );
}
