/**
 * Point editing for a path cutout: open its points on the board, and while
 * they are open, make the selected ones smooth or sharp. Double-click and
 * Enter open them too; this is the route a user can see.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { FieldLabel } from '@/shared/components/PanelText';
import type { PointKind } from '../panel/CutoutsSection/handlers/pointEdits';

/** What the inspector needs from the board's point editing. */
export interface PointTool {
  /** The path whose points are open on the board, if any. */
  readonly editingId: string | null;
  /** How many points are selected while they are open. */
  readonly selectedCount: number;
  readonly onEdit: (id: string) => void;
  readonly onDone: () => void;
  readonly onKind: (kind: PointKind) => void;
}

export interface CutoutPointControlsProps {
  readonly cutoutId: string;
  readonly tool: PointTool;
  readonly disabled?: boolean;
}

export function CutoutPointControls({
  cutoutId,
  tool,
  disabled = false,
}: CutoutPointControlsProps) {
  const t = useTranslation();

  if (tool.editingId !== cutoutId) {
    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={disabled}
          onClick={() => tool.onEdit(cutoutId)}
        >
          {t('binDesigner.cutouts.points.edit')}
        </Button>
        <p className="text-micro text-content-tertiary">
          {t('binDesigner.cutouts.points.editHint')}
        </p>
      </div>
    );
  }

  const none = tool.selectedCount === 0;
  return (
    <div className="space-y-1.5">
      <FieldLabel info={t('binDesigner.cutouts.points.toolsDetail')}>
        {none
          ? t('binDesigner.cutouts.points.noneSelected')
          : t('binDesigner.cutouts.points.selected', { count: tool.selectedCount })}
      </FieldLabel>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || none}
          onClick={() => tool.onKind('smooth')}
        >
          {t('binDesigner.cutouts.points.smooth')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || none}
          onClick={() => tool.onKind('corner')}
        >
          {t('binDesigner.cutouts.points.corner')}
        </Button>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        aria-pressed
        onClick={tool.onDone}
      >
        {t('binDesigner.cutouts.points.done')}
      </Button>
      <p className="text-micro text-content-tertiary">{t('binDesigner.cutouts.points.hint')}</p>
    </div>
  );
}
