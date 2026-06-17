/**
 * Board/canvas settings shown in the inspector dock when nothing is selected,
 * so the panel stays useful instead of blank. Surfaces the editor-level
 * controls (snap, grid size) plus the read-only board footprint.
 */

import { Button, Checkbox } from '@/design-system';
import { useTranslation } from '@/i18n';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

const GRID_SIZES = [0.25, 0.5, 1, 2, 5] as const;

interface CutoutBoardSettingsProps {
  readonly gridSize: number;
  readonly onGridSizeChange: (size: number) => void;
  readonly snapEnabled: boolean;
  readonly onSnapToggle: (enabled: boolean) => void;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cutoutCount: number;
}

function fmt(mm: number): string {
  return Number.isInteger(mm) ? String(mm) : String(Math.round(mm * 100) / 100);
}

export function CutoutBoardSettings({
  gridSize,
  onGridSizeChange,
  snapEnabled,
  onSnapToggle,
  binWidth,
  binDepth,
  cutoutCount,
}: CutoutBoardSettingsProps) {
  const t = useTranslation();
  return (
    <div className="space-y-4 pt-3">
      {/* Selection guidance — kept distinct from the board settings below. */}
      <p className="text-[11px] leading-relaxed text-content-tertiary">
        {t('binDesigner.cutoutEditor.inspectorEmptyHint')}
      </p>

      <div className="space-y-3 border-t border-stroke-subtle pt-3">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
          {t('binDesigner.cutoutEditor.boardSettings')}
        </span>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-content-secondary">
          <Checkbox
            checked={snapEnabled}
            onChange={onSnapToggle}
            aria-label={t('binDesigner.cutouts.snapToGrid')}
          />
          <span>{t('binDesigner.cutouts.snapToGrid')}</span>
        </label>

        {snapEnabled && (
          <div className="space-y-1">
            <span className="block text-[10px] text-content-tertiary">
              {t('binDesigner.gridSize')}
            </span>
            <div
              role="group"
              aria-label={t('binDesigner.gridSize')}
              className="inline-flex gap-0.5 rounded-lg bg-surface-tertiary p-0.5"
            >
              {GRID_SIZES.map((size) => (
                <Button
                  key={size}
                  type="button"
                  variant="ghost"
                  onClick={() => onGridSizeChange(size)}
                  aria-pressed={gridSize === size}
                  className={`px-2 tabular-nums leading-none ${getSegmentClass(gridSize === size)}`}
                >
                  {fmt(size)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <dl className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <dt className="text-content-tertiary">{t('binDesigner.cutoutEditor.boardSize')}</dt>
            <dd className="tabular-nums text-content-secondary">
              {fmt(binWidth)} × {fmt(binDepth)} mm
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-content-tertiary">{t('binDesigner.cutoutEditor.boardCutouts')}</dt>
            <dd className="tabular-nums text-content-secondary">{cutoutCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
