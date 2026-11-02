import { useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { Alert, Button } from '@/design-system';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { LabelInfo } from '../shared/panelText';
import { derivedLabel } from './shapeListModel';
import { MIN_FLOOR_MM, type PocketIssue } from './pocketChecks';

export interface PocketChecksView {
  readonly issues: readonly PocketIssue[];
  readonly cutouts: readonly Cutout[];
  readonly onSelect: (ids: readonly string[]) => void;
  readonly onFix: (issue: PocketIssue) => void;
}

export interface PocketIssueListProps extends PocketChecksView {
  readonly disabled?: boolean;
}

const SHOWN = 6;

export function PocketIssueList({
  issues,
  cutouts,
  onSelect,
  onFix,
  disabled = false,
}: PocketIssueListProps) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (issues.length === 0) return null;

  const byId = new Map(cutouts.map((c) => [c.id, c]));
  const nameOf = (id: string): string => {
    const c = byId.get(id);
    if (!c) return id;
    if (c.name?.trim()) return c.name.trim();
    const d = derivedLabel(c);
    return t(d.key, d.values);
  };
  const message = (issue: PocketIssue): string => {
    const a = nameOf(issue.ids[0]);
    const b = issue.ids.length > 1 ? nameOf(issue.ids[1]) : a;
    const mm = issue.mm.toFixed(1);
    const repeat = issue.ids.length === 1;
    switch (issue.kind) {
      case 'merge':
        return repeat
          ? t('binDesigner.cutoutEditor.checks.mergeRepeat', { a })
          : t('binDesigner.cutoutEditor.checks.merge', { a, b });
      case 'thin':
        return repeat
          ? t('binDesigner.cutoutEditor.checks.thinRepeat', { a, mm })
          : t('binDesigner.cutoutEditor.checks.thin', { a, b, mm });
      case 'wall':
        return issue.mm > 0
          ? t('binDesigner.cutoutEditor.checks.wall', { a, mm })
          : t('binDesigner.cutoutEditor.checks.wallThrough', { a });
      case 'lip':
        return t('binDesigner.cutoutEditor.checks.lip', { a, mm });
      case 'island':
        return t('binDesigner.cutoutEditor.checks.island', { a, mm });
      case 'floor':
        return t('binDesigner.cutoutEditor.checks.floor', { a, mm });
    }
  };

  return (
    <Alert intent="warning" icon={<AlertTriangleIcon size="xs" className="mt-0.5" />}>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-warning">
          {t('binDesigner.cutoutEditor.checks.title')}
        </span>
        <LabelInfo label={t('binDesigner.cutoutEditor.checks.title')}>
          {t('binDesigner.cutoutEditor.checks.titleDetail')}
        </LabelInfo>
      </div>
      <ul className="mt-1 space-y-1">
        {(expanded ? issues : issues.slice(0, SHOWN)).map((issue) => (
          <li key={`${issue.kind}:${issue.ids.join(':')}`} className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              disabled={disabled}
              onClick={() => onSelect(issue.ids)}
              className="h-auto justify-start whitespace-normal px-0 py-0 text-left font-normal leading-snug text-warning hover:underline"
            >
              {message(issue)}
            </Button>
            {issue.fix && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => onFix(issue)}
              >
                {issue.kind === 'island'
                  ? t('binDesigner.cutoutEditor.checks.islandFix')
                  : t('binDesigner.cutoutEditor.checks.floorFix', {
                      mm: MIN_FLOOR_MM.toFixed(1),
                    })}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {issues.length > SHOWN && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1 h-auto px-0 py-0 text-warning/80 hover:underline"
        >
          {expanded
            ? t('binDesigner.cutoutEditor.checks.fewer')
            : t('binDesigner.cutoutEditor.checks.more', { count: issues.length - SHOWN })}
        </Button>
      )}
    </Alert>
  );
}
