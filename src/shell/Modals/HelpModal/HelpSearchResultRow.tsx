/**
 * Renders one row in the unified Help search results list. Branches on
 * entry kind: shortcuts get the existing key-cap rendering; features get a
 * "Go to" deep-link button; tips render description-only.
 */

import { useTranslation } from '@/i18n';
import type { HelpEntry } from './helpEntry';
import { KeyboardKey } from './HelpModalSections';
import { KEY_SEPARATOR } from './helpModalStyles';
import { jumpToHelpTarget } from './helpJumpDispatcher';

interface HelpSearchResultRowProps {
  entry: HelpEntry;
  modifierKey: string;
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
  modifierKey,
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
        <ShortcutKeyCaps entry={entry} modifierKey={modifierKey} />
      ) : entry.kind === 'feature' && showJumpButton ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0"
          onClick={() => {
            onJump();
            void jumpToHelpTarget(entry.target);
          }}
        >
          {t('help.goTo')}
        </button>
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
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-elevated text-content-tertiary">
      {label}
    </span>
  );
}

function ShortcutKeyCaps({
  entry,
  modifierKey,
}: {
  entry: Extract<HelpEntry, { kind: 'shortcut' }>;
  modifierKey: string;
}) {
  const keys = typeof entry.keys === 'string' ? entry.keys.split(' / ') : [...entry.keys];
  return (
    <div className="flex items-center gap-1 shrink-0">
      {entry.modifier && (
        <>
          <KeyboardKey>{modifierKey}</KeyboardKey>
          <span className="text-content-tertiary text-xs">{KEY_SEPARATOR}</span>
        </>
      )}
      {entry.shift && (
        <>
          <KeyboardKey>Shift</KeyboardKey>
          <span className="text-content-tertiary text-xs">{KEY_SEPARATOR}</span>
        </>
      )}
      {keys.map((key, idx) => (
        <span key={`${key}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && <span className="text-content-tertiary text-xs mx-0.5">/</span>}
          <KeyboardKey>{key}</KeyboardKey>
        </span>
      ))}
    </div>
  );
}
