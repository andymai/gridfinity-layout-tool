/**
 * Click-lock lid section.
 *
 * Master toggle with sub-controls for fit, stackable top grid, magnet holes,
 * and configurable wall + top thickness. Disabled when the bin's stacking
 * lip is off (the lid mates with the lip).
 */

import { FeatureToggle } from '../FeatureToggle';
import { Switch } from '@/design-system/Switch';
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
    >
      {/* Print-time hint — the mating cavity and click rails are
          downward-facing overhangs that need supports for a clean print. */}
      <p className="text-[11px] text-content-tertiary leading-relaxed">
        {t('binDesigner.lid.printNote')}
      </p>

      {/* Fit picker */}
      <div>
        <label className="text-xs font-medium text-content-secondary mb-1 block">
          {t('binDesigner.lid.fitLabel')}
        </label>
        <div className="flex gap-1">
          {FIT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handlers.setFit(option)}
              aria-pressed={state.fit === option}
              className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors min-h-[36px] ${
                state.fit === option
                  ? 'bg-accent text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.fit.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Stackable top grid */}
      <Switch
        label={t('binDesigner.lid.stackableTop')}
        checked={state.stackableTop}
        onChange={handlers.toggleStackableTop}
      />

      {/* Magnet holes */}
      <Switch
        label={t('binDesigner.lid.magnetHoles')}
        checked={state.magnetHoles}
        onChange={handlers.toggleMagnetHoles}
      />

      {/* Wall thickness */}
      <SnappingSlider
        label={t('binDesigner.lid.wallThickness')}
        value={state.wallThickness}
        onChange={handlers.setWallThickness}
        options={state.thicknessOptions}
      />

      {/* Top thickness */}
      <SnappingSlider
        label={t('binDesigner.lid.topThickness')}
        value={state.topThickness}
        onChange={handlers.setTopThickness}
        options={state.thicknessOptions}
      />

      {/* Click-rail coverage — shorter rails save filament; rails always
          stay centered on each wall so engagement stays symmetric. */}
      <SnappingSlider
        label={t('binDesigner.lid.clickRailCoverage')}
        value={state.clickRailCoverage}
        onChange={handlers.setClickRailCoverage}
        options={state.railCoverageOptions}
        unit="%"
      />
    </FeatureToggle>
  );
}
