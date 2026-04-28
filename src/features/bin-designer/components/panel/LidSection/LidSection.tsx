/**
 * Click-lock lid section.
 *
 * Composed layout (matches HandleSection): the Fit picker lives in
 * `primaryControls` so it's always visible while the lid is on; the
 * customize area carries the secondary controls plus a live mm readout
 * grounding the percentages in real geometry.
 */

import { FeatureToggle } from '../FeatureToggle';
import { Switch } from '@/design-system/Switch';
import { RulerIcon } from '@/design-system/Icon';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useLidSection, FIT_OPTIONS } from './useLidSection';

export function LidSection() {
  const { state, handlers, t } = useLidSection();

  return (
    <FeatureToggle
      label={t('binDesigner.lid')}
      checked={state.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={state.requiresStackingLipReason}
      valueSummary={state.valueSummary}
      badge={
        <span className="rounded bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning">
          {t('settings.experimental')}
        </span>
      }
      primaryControls={
        // Fit is the most consequential lid choice — keep it always visible
        // when the lid is on, before the "Customize" gate. Mirrors
        // HandleSection's shape selector + side chips pattern.
        <div className="flex gap-1">
          {FIT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handlers.setFit(option)}
              aria-pressed={state.fit === option}
              className={`flex-1 rounded px-3 py-2 text-xs font-medium transition-colors min-h-[36px] ${
                state.fit === option
                  ? 'bg-accent text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.fit.${option}`)}
            </button>
          ))}
        </div>
      }
    >
      {/* Print-time hint — the mating cavity and click rails are
          downward-facing overhangs that need supports for a clean print. */}
      <p className="text-[11px] leading-relaxed text-content-tertiary">
        {t('binDesigner.lid.printNote')}
      </p>

      {/* Wall + Top thickness paired side-by-side (LabelTabsSection pattern). */}
      <div className="grid grid-cols-2 gap-3">
        <SnappingSlider
          label={t('binDesigner.lid.wallThickness')}
          value={state.wallThickness}
          onChange={handlers.setWallThickness}
          options={state.thicknessOptions}
        />
        <SnappingSlider
          label={t('binDesigner.lid.topThickness')}
          value={state.topThickness}
          onChange={handlers.setTopThickness}
          options={state.thicknessOptions}
        />
      </div>

      {/* Live physical readout — grounds the params in real-world mm so
          users can sanity-check before printing. Matches LabelTabsSection
          and HandleSection conventions. */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">{state.dimensionsReadout}</span>
      </div>

      {/* Switches for the orthogonal toggles. */}
      <Switch
        label={t('binDesigner.lid.stackableTop')}
        checked={state.stackableTop}
        onChange={handlers.toggleStackableTop}
      />
      <Switch
        label={t('binDesigner.lid.magnetHoles')}
        checked={state.magnetHoles}
        onChange={handlers.toggleMagnetHoles}
      />

      {/* Click-rail coverage — shorter rails save filament; rails always
          stay centered on each wall so engagement stays symmetric. */}
      <div className="space-y-1">
        <SnappingSlider
          label={t('binDesigner.lid.clickRailCoverage')}
          value={state.clickRailCoverage}
          onChange={handlers.setClickRailCoverage}
          options={state.railCoverageOptions}
          unit="%"
        />
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <RulerIcon size="xs" />
          <span className="tabular-nums">{state.railsReadout}</span>
        </div>
      </div>
    </FeatureToggle>
  );
}
