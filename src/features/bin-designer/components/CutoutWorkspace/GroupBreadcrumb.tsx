/**
 * Where in the group tree the editor is currently working.
 *
 * Drilling in changes what a click selects and what an arrange operation moves,
 * and none of that is visible on the canvas by itself — the same three shapes
 * are on screen either way. The trail says which level is live and lets any
 * ancestor be jumped back to, so the state is reversible by pointer and not
 * only by Escape.
 *
 * Renders nothing at the top level, where there is no state to explain.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import { countUnits } from '@/features/bin-designer/utils/cutoutHierarchy';

/** Stable identity so an unnamed design does not re-render the breadcrumb. */
const EMPTY_GROUP_NAMES: Readonly<Record<string, string>> = {};

export interface GroupBreadcrumbProps {
  readonly cutouts: readonly Cutout[];
  readonly groupNames?: Readonly<Record<string, string>>;
  /** Groups the editor is inside, outermost first. */
  readonly context: readonly string[];
  readonly onNavigate: (context: readonly string[]) => void;
}

export function GroupBreadcrumb({
  cutouts,
  groupNames = EMPTY_GROUP_NAMES,
  context,
  onNavigate,
}: GroupBreadcrumbProps) {
  const t = useTranslation();
  if (context.length === 0) return null;

  return (
    <nav
      aria-label={t('binDesigner.groupBreadcrumb.label')}
      className="flex min-w-0 items-center gap-0.5 text-label text-content-tertiary"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        touchTarget={false}
        className="px-1 py-0 text-label text-content-secondary"
        onClick={() => onNavigate([])}
      >
        {t('binDesigner.groupBreadcrumb.root')}
      </Button>
      {context.map((groupId, i) => {
        const to = context.slice(0, i + 1);
        const name = (groupNames[groupId] ?? '').trim();
        const label =
          name !== ''
            ? name
            : t('binDesigner.shapeList.group', { count: String(countUnits(cutouts, to)) });
        const current = i === context.length - 1;
        return (
          <span key={groupId} className="flex min-w-0 items-center gap-0.5">
            <svg
              className="h-2.5 w-2.5 flex-shrink-0 text-content-tertiary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeWidth={2} strokeLinecap="round" d="M9 6l6 6-6 6" />
            </svg>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              // The last segment is where you already are: it stays as a label
              // rather than a control that does nothing when pressed.
              disabled={current}
              aria-current={current ? 'true' : undefined}
              className={`max-w-[10rem] truncate px-1 py-0 text-label ${
                current ? 'text-content' : 'text-content-secondary'
              }`}
              onClick={() => onNavigate(to)}
              title={label}
            >
              {label}
            </Button>
          </span>
        );
      })}
    </nav>
  );
}
