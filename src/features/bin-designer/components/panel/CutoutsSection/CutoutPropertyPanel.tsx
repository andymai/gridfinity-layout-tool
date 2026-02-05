/**
 * Property panel for editing selected cutout dimensions and position.
 *
 * Shows number inputs for single selection, or summary + bulk actions
 * for multi-selection.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { SliderInput } from '../../controls/SliderInput';

interface CutoutPropertyPanelProps {
  readonly cutout: Cutout;
  readonly maxWidth: number;
  readonly maxDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
}

export function CutoutPropertyPanel({
  cutout,
  maxWidth,
  maxDepth,
  maxCutDepth,
  onUpdate,
  onRemove,
  onDuplicate,
}: CutoutPropertyPanelProps) {
  const t = useTranslation();

  return (
    <div className="space-y-2 rounded border border-stroke-subtle bg-surface-elevated p-3">
      <div className="space-y-1">
        <SliderInput
          label={t('binDesigner.cutouts.positionX')}
          value={cutout.x}
          onChange={(x) => onUpdate(cutout.id, { x })}
          min={0}
          max={maxWidth - cutout.width}
          step={0.5}
          unit="mm"
        />
        <SliderInput
          label={t('binDesigner.cutouts.positionY')}
          value={cutout.y}
          onChange={(y) => onUpdate(cutout.id, { y })}
          min={0}
          max={maxDepth - (cutout.shape === 'circle' ? cutout.width : cutout.depth)}
          step={0.5}
          unit="mm"
        />
        <SliderInput
          label={t('binDesigner.cutouts.width')}
          value={cutout.width}
          onChange={(width) => onUpdate(cutout.id, { width })}
          min={2}
          max={maxWidth}
          step={0.5}
          unit="mm"
        />
        {cutout.shape === 'rectangle' && (
          <SliderInput
            label={t('binDesigner.cutouts.depth')}
            value={cutout.depth}
            onChange={(depth) => onUpdate(cutout.id, { depth })}
            min={2}
            max={maxDepth}
            step={0.5}
            unit="mm"
          />
        )}
        <SliderInput
          label={t('binDesigner.cutouts.cutDepth')}
          value={cutout.cutDepth}
          onChange={(cutDepth) => onUpdate(cutout.id, { cutDepth })}
          min={0.5}
          max={maxCutDepth}
          step={0.5}
          unit="mm"
        />
        {cutout.shape === 'rectangle' && (
          <SliderInput
            label={t('binDesigner.cutouts.cornerRadius')}
            value={cutout.cornerRadius}
            onChange={(cornerRadius) => onUpdate(cutout.id, { cornerRadius })}
            min={0}
            max={Math.min(cutout.width, cutout.depth) / 2}
            step={0.5}
            unit="mm"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
          onClick={() => onDuplicate([cutout.id])}
        >
          {t('binDesigner.cutouts.duplicate')}
        </button>
        <button
          type="button"
          className="rounded border border-red-500/30 bg-surface-elevated px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={() => onRemove(cutout.id)}
        >
          {t('binDesigner.cutouts.delete')}
        </button>
      </div>
    </div>
  );
}
