/**
 * Eco Mode section: material-saving bin features.
 *
 * Provides toggles for honeycomb floor, honeycomb walls, and
 * sinusoidal wave walls, plus an eco preset button and savings display.
 *
 * Honeycomb walls and wave walls are mutually exclusive — the hook
 * enforces this by disabling the other when one is enabled.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SliderInput } from '../../controls/SliderInput';
import { FeatureToggle } from '../FeatureToggle';
import { useTranslation } from '@/i18n';
import { useEcoSection } from './useEcoSection';
import type { WallHoneycombMode } from '@/features/bin-designer/types';

export function EcoSection() {
  const { state, handlers, meta } = useEcoSection();
  const t = useTranslation();

  return (
    <CollapsibleSection
      title={t('binDesigner.eco.title')}
      defaultExpanded={true}
      summary={meta.summary}
    >
      {/* Eco preset button */}
      <button
        type="button"
        onClick={handlers.applyEcoPreset}
        className="mb-3 w-full rounded-md bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-400 dark:hover:bg-green-600/30 transition-colors"
      >
        {t('binDesigner.eco.applyPreset')}
      </button>

      {/* Savings display */}
      {state.savingsPercent > 0 && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {t('binDesigner.eco.savings', { percent: state.savingsPercent })}
        </div>
      )}

      <div className="space-y-1">
        {/* Honeycomb floor */}
        <FeatureToggle
          label={t('binDesigner.eco.honeycombFloor')}
          checked={state.eco.honeycombFloor.enabled}
          onChange={handlers.toggleHoneycombFloor}
          valueSummary={
            state.eco.honeycombFloor.cellSize === 'auto'
              ? t('binDesigner.eco.autoSize')
              : `${state.eco.honeycombFloor.cellSize}mm`
          }
        >
          <SliderInput
            label={t('binDesigner.eco.cellSize')}
            value={
              state.eco.honeycombFloor.cellSize === 'auto' ? 8 : state.eco.honeycombFloor.cellSize
            }
            onChange={handlers.setHoneycombFloorCellSize}
            min={DESIGNER_CONSTRAINTS.MIN_HONEYCOMB_CELL_SIZE}
            max={DESIGNER_CONSTRAINTS.MAX_HONEYCOMB_CELL_SIZE}
            step={DESIGNER_CONSTRAINTS.HONEYCOMB_CELL_SIZE_STEP}
            unit="mm"
          />
          <SliderInput
            label={t('binDesigner.eco.margin')}
            value={state.eco.honeycombFloor.margin}
            onChange={handlers.setHoneycombFloorMargin}
            min={DESIGNER_CONSTRAINTS.MIN_HONEYCOMB_MARGIN}
            max={DESIGNER_CONSTRAINTS.MAX_HONEYCOMB_MARGIN}
            step={DESIGNER_CONSTRAINTS.HONEYCOMB_MARGIN_STEP}
            unit="mm"
          />
        </FeatureToggle>

        {/* Honeycomb walls */}
        <FeatureToggle
          label={t('binDesigner.eco.honeycombWalls')}
          checked={state.eco.honeycombWall.mode !== 'none'}
          onChange={handlers.toggleHoneycombWall}
          disabledReason={
            state.wallEcoDisabledReason ??
            (state.eco.sinusoidalWall.enabled ? t('binDesigner.eco.exclusiveWithWave') : undefined)
          }
          primaryControls={
            state.eco.honeycombWall.mode !== 'none' ? (
              <WallModeSelector
                mode={state.eco.honeycombWall.mode}
                onChange={handlers.setHoneycombWallMode}
              />
            ) : undefined
          }
        >
          <SliderInput
            label={t('binDesigner.eco.cellSize')}
            value={
              state.eco.honeycombWall.cellSize === 'auto' ? 6 : state.eco.honeycombWall.cellSize
            }
            onChange={handlers.setHoneycombWallCellSize}
            min={DESIGNER_CONSTRAINTS.MIN_HONEYCOMB_CELL_SIZE}
            max={DESIGNER_CONSTRAINTS.MAX_HONEYCOMB_CELL_SIZE}
            step={DESIGNER_CONSTRAINTS.HONEYCOMB_CELL_SIZE_STEP}
            unit="mm"
          />
          <SliderInput
            label={t('binDesigner.eco.topMargin')}
            value={state.eco.honeycombWall.topMargin}
            onChange={handlers.setHoneycombWallTopMargin}
            min={DESIGNER_CONSTRAINTS.MIN_HONEYCOMB_MARGIN}
            max={DESIGNER_CONSTRAINTS.MAX_HONEYCOMB_MARGIN}
            step={DESIGNER_CONSTRAINTS.HONEYCOMB_MARGIN_STEP}
            unit="mm"
          />
          <SliderInput
            label={t('binDesigner.eco.bottomMargin')}
            value={state.eco.honeycombWall.bottomMargin}
            onChange={handlers.setHoneycombWallBottomMargin}
            min={DESIGNER_CONSTRAINTS.MIN_HONEYCOMB_MARGIN}
            max={DESIGNER_CONSTRAINTS.MAX_HONEYCOMB_MARGIN}
            step={DESIGNER_CONSTRAINTS.HONEYCOMB_MARGIN_STEP}
            unit="mm"
          />
        </FeatureToggle>

        {/* Partial slot note — shown when some walls are skipped */}
        {state.wallEcoPartialNote &&
          (state.eco.honeycombWall.mode !== 'none' || state.eco.sinusoidalWall.enabled) && (
            <p className="text-[11px] text-content-tertiary -mt-0.5 mb-1">
              {state.wallEcoPartialNote}
            </p>
          )}

        {/* Wave walls */}
        <FeatureToggle
          label={t('binDesigner.eco.waveWalls')}
          checked={state.eco.sinusoidalWall.enabled}
          onChange={handlers.toggleSinusoidalWall}
          disabledReason={
            state.wallEcoDisabledReason ??
            (state.eco.honeycombWall.mode !== 'none'
              ? t('binDesigner.eco.exclusiveWithHoneycomb')
              : undefined)
          }
          valueSummary={
            state.eco.sinusoidalWall.amplitude === 'auto'
              ? t('binDesigner.eco.autoSize')
              : `${state.eco.sinusoidalWall.amplitude}mm amp`
          }
        >
          <SliderInput
            label={t('binDesigner.eco.amplitude')}
            value={
              state.eco.sinusoidalWall.amplitude === 'auto'
                ? 1.8
                : state.eco.sinusoidalWall.amplitude
            }
            onChange={handlers.setWaveAmplitude}
            min={DESIGNER_CONSTRAINTS.MIN_WAVE_AMPLITUDE}
            max={DESIGNER_CONSTRAINTS.MAX_WAVE_AMPLITUDE}
            step={DESIGNER_CONSTRAINTS.WAVE_AMPLITUDE_STEP}
            unit="mm"
          />
          <SliderInput
            label={t('binDesigner.eco.frequency')}
            value={
              state.eco.sinusoidalWall.frequency === 'auto' ? 2 : state.eco.sinusoidalWall.frequency
            }
            onChange={handlers.setWaveFrequency}
            min={DESIGNER_CONSTRAINTS.MIN_WAVE_FREQUENCY}
            max={DESIGNER_CONSTRAINTS.MAX_WAVE_FREQUENCY}
            step={DESIGNER_CONSTRAINTS.WAVE_FREQUENCY_STEP}
            unit="/u"
          />
          <SliderInput
            label={t('binDesigner.eco.baseThickness')}
            value={state.eco.sinusoidalWall.baseThickness}
            onChange={handlers.setWaveBaseThickness}
            min={DESIGNER_CONSTRAINTS.MIN_WAVE_BASE_THICKNESS}
            max={DESIGNER_CONSTRAINTS.MAX_WAVE_BASE_THICKNESS}
            step={DESIGNER_CONSTRAINTS.WAVE_BASE_THICKNESS_STEP}
            unit="mm"
          />
        </FeatureToggle>
      </div>
    </CollapsibleSection>
  );
}

// ─── Inline Components ───────────────────────────────────────────────────────

/** Segmented control for pocketed/perforated wall honeycomb mode */
function WallModeSelector({
  mode,
  onChange,
}: {
  mode: WallHoneycombMode;
  onChange: (mode: WallHoneycombMode) => void;
}) {
  const t = useTranslation();

  return (
    <div className="inline-flex rounded-md border border-stroke-subtle overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('pocketed')}
        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
          mode === 'pocketed'
            ? 'bg-accent text-white'
            : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
        }`}
      >
        {t('binDesigner.eco.pocketed')}
      </button>
      <button
        type="button"
        onClick={() => onChange('perforated')}
        className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-l border-stroke-subtle ${
          mode === 'perforated'
            ? 'bg-accent text-white'
            : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
        }`}
      >
        {t('binDesigner.eco.perforated')}
      </button>
    </div>
  );
}
