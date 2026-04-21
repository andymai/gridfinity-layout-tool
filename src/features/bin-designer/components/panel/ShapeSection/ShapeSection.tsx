/**
 * Shape section: "Custom shape" toggle + paint-style footprint editor.
 *
 * Off: pure rectangle (fast generator path, cellMask undefined).
 * On: reveals preset buttons + half-bin paint grid + context hint. A
 * fully-filled mask is still counted as "rectangle" for generation, so
 * flipping the toggle on without painting doesn't slow anything down.
 */
import { useCallback } from 'react';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
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
    <FeatureToggle
      label={t('binDesigner.shape.customShape')}
      checked={state.editingEnabled}
      onChange={handlers.toggleEditingEnabled}
      badge={
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-muted text-warning">
          {t('settings.experimental')}
        </span>
      }
      primaryControls={
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
            <button
              type="button"
              onClick={handlers.resetShape}
              disabled={!state.isCustom}
              className="ml-auto text-[11px] font-medium text-accent transition-colors hover:text-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.reset')}
            </button>
          </div>
          <p className="text-[11px] text-content-tertiary">{t('binDesigner.shape.gridHelp')}</p>
          <ShapeGrid
            mask={state.mask}
            onToggleCell={handlers.toggleCell}
            ariaLabel={t('binDesigner.shape.grid.ariaLabel')}
            cellLabel={cellLabel}
          />
          {state.isCustom && (
            <p className="text-[11px] text-content-tertiary">
              {t('binDesigner.shape.custom.hint')}
            </p>
          )}
        </div>
      }
    />
  );
}
