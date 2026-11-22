/** The visible route to a path's points; double-click and Enter are the hidden ones. */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { FieldLabel } from '@/shared/components/PanelText';
import type { PointKind } from '../panel/CutoutsSection/handlers/pointEdits';

export interface PointTool {
  readonly editingId: string | null;
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
