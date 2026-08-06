/**
 * Warnings that have escaped their collapsed group.
 *
 * Progressive disclosure defers OPTIONS; it must never defer an active problem.
 * Both label warnings (colliding front tabs, a lip taller than its shelf) come
 * with a one-click fix, so burying them behind a chevron would hide the fix
 * along with the diagnosis.
 *
 * Rendered only for groups that are currently collapsed — an expanded group
 * shows its own warning in context, and printing both would say it twice.
 */

import { Button, InfoIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { LabelWarning, LabelWarningGroup } from './useLabelTabsSection';

interface LabelSectionWarningsProps {
  readonly warnings: readonly LabelWarning[];
  /** Groups currently expanded; their warnings render in context instead. Wider
   *  than `LabelWarningGroup` because the caller's set also holds groups that
   *  own no warning. */
  readonly expandedGroups: ReadonlySet<string>;
  /** Expand the group owning a warning, so the control is reachable. */
  readonly onJumpToGroup: (group: LabelWarningGroup) => void;
  /** Human-readable group names, for the jump link. */
  readonly groupTitles: Readonly<Record<LabelWarningGroup, string>>;
}

export function LabelSectionWarnings({
  warnings,
  expandedGroups,
  onJumpToGroup,
  groupTitles,
}: LabelSectionWarningsProps) {
  const t = useTranslation();
  const escaped = warnings.filter((w) => !expandedGroups.has(w.group));
  if (escaped.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {escaped.map((warning) => (
        <div key={warning.id} className="flex items-start gap-2 text-xs text-warning">
          <InfoIcon size="xs" className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{warning.message}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              onClick={() => onJumpToGroup(warning.group)}
              className="px-0 font-medium text-content-tertiary hover:bg-transparent hover:text-content"
            >
              {t('binDesigner.labelWarningJump', { group: groupTitles[warning.group] })}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={warning.onFix}
            className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
          >
            {warning.fixLabel}
          </Button>
        </div>
      ))}
    </div>
  );
}
