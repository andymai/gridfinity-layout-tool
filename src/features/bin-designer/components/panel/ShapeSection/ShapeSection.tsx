/**
 * Shape section: custom bin footprint editor.
 *
 * Lets the user paint a non-rectangular shape on a half-bin-resolution
 * grid, or pick from common presets (L, T, U). Rectangular bins take the
 * fast generator path; partial masks produce polygon footprints.
 */
import { useCallback } from 'react';
import { useShapeSection } from './useShapeSection';
import { ShapeGrid } from './ShapeGrid';

export function ShapeSection() {
  const { state, handlers, t } = useShapeSection();

  const cellLabel = useCallback(
    (col: number, row: number, filled: boolean): string =>
      t(
        filled
          ? 'binDesigner.shape.grid.cellLabel.filled'
          : 'binDesigner.shape.grid.cellLabel.empty',
        { col, row }
      ),
    [t]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-content-tertiary">{t('binDesigner.shape.presets')}</span>
        {state.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlers.applyPreset(p.id)}
            disabled={!p.available}
            className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div>
        <ShapeGrid
          mask={state.mask}
          onToggleCell={handlers.toggleCell}
          ariaLabel={t('binDesigner.shape.grid.ariaLabel')}
          cellLabel={cellLabel}
        />
      </div>
      <p className="text-[11px] text-content-tertiary">
        {state.isCustom
          ? t('binDesigner.shape.custom.hint')
          : t('binDesigner.shape.rectangle.hint')}
      </p>
    </div>
  );
}
