/**
 * Overhang section: per-side outward body expansion (mm) + optional wall taper.
 *
 * Overhang grows the bin walls + stacking lip outward to fill the centering gap
 * a non-integral grid leaves in a drawer. Feet stay at the nominal footprint
 * (flat bottom under the overhang) unless the feet toggle is enabled. The taper
 * (#2933) instead angles the outer wall back toward nominal at the base so the
 * bin hugs a drawer's rounded corner; it insets within the overhang (so a side
 * only tapers where it has overhang) and is mutually exclusive with feet.
 * A feature toggle gates the per-side controls; values are retained while off.
 * Suppressed for custom-shape bins.
 */

import { Checkbox, SliderInput, SegmentedControl } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import type { WallTaperProfile } from '@/core/types';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { FeatureToggle } from '../FeatureToggle';
import { useOverhangSection, type OverhangSide } from './useOverhangSection';

export function OverhangSection() {
  const { state, handlers, meta, t } = useOverhangSection();

  const sides: { side: OverhangSide; label: string }[] = [
    { side: 'left', label: t('binDesigner.overhang.side.left') },
    { side: 'right', label: t('binDesigner.overhang.side.right') },
    { side: 'front', label: t('binDesigner.overhang.side.front') },
    { side: 'back', label: t('binDesigner.overhang.side.back') },
  ];

  const profileOptions: SegmentedControlOption<WallTaperProfile>[] = [
    { value: 'chamfer', label: t('binDesigner.overhang.taper.profileChamfer') },
    { value: 'fillet', label: t('binDesigner.overhang.taper.profileFillet') },
  ];

  const { taper } = state;
  const feetEnabled = state.hasOverhang && !taper.enabled;
  const taperToggleEnabled = taper.canTaper && !state.feet;

  let taperHintKey = 'binDesigner.overhang.taper.hint';
  if (state.feet) taperHintKey = 'binDesigner.overhang.taper.feetConflict';
  else if (!taper.availableForBin) taperHintKey = 'binDesigner.overhang.taper.singleHollowOnly';
  else if (!state.hasOverhang) taperHintKey = 'binDesigner.overhang.taper.needsOverhang';

  return (
    <FeatureToggle
      label={t('binDesigner.overhang.title')}
      checked={state.enabled}
      onChange={handlers.toggle}
      disabledReason={meta.disabledReason}
      primaryControls={
        <>
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.overhang.hint')}
          </p>
          {sides.map(({ side, label }) => (
            // Wrapper relays hover + keyboard focus to the 3D wall highlight
            // without touching the shared SliderInput primitive (onFocus/onBlur
            // bubble from the inner input).
            <div
              key={side}
              onMouseEnter={() => handlers.setHovered(side)}
              onMouseLeave={() => handlers.setHovered(null)}
              onFocus={() => handlers.setHovered(side)}
              onBlur={() => handlers.setHovered(null)}
            >
              <SliderInput
                label={label}
                value={state.overhang[side]}
                onChange={(v) => handlers.setSide(side, v)}
                min={DESIGNER_CONSTRAINTS.MIN_OVERHANG}
                max={DESIGNER_CONSTRAINTS.MAX_OVERHANG}
                step={DESIGNER_CONSTRAINTS.OVERHANG_STEP}
                unit="mm"
              />
            </div>
          ))}
          <div
            className="group flex cursor-pointer items-center justify-between"
            onMouseEnter={feetEnabled ? () => handlers.setHovered('feet') : undefined}
            onMouseLeave={feetEnabled ? () => handlers.setHovered(null) : undefined}
            onFocus={feetEnabled ? () => handlers.setHovered('feet') : undefined}
            onBlur={feetEnabled ? () => handlers.setHovered(null) : undefined}
            onClick={feetEnabled ? handlers.toggleFeet : undefined}
            onKeyDown={(e) => {
              if (feetEnabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handlers.toggleFeet();
              }
            }}
            role="checkbox"
            aria-checked={state.feet}
            aria-disabled={!feetEnabled}
            aria-label={t('binDesigner.overhang.feet')}
            tabIndex={feetEnabled ? 0 : -1}
          >
            <span
              className={`text-xs leading-none ${feetEnabled ? 'text-content-secondary' : 'text-content-disabled'}`}
            >
              {t('binDesigner.overhang.feet')}
            </span>
            <Checkbox checked={state.feet} disabled={!feetEnabled} />
          </div>
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.overhang.feetHint')}
          </p>

          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <div
              className="group flex cursor-pointer items-center justify-between"
              onClick={taperToggleEnabled ? handlers.toggleTaper : undefined}
              onKeyDown={(e) => {
                if (taperToggleEnabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handlers.toggleTaper();
                }
              }}
              role="checkbox"
              aria-checked={taper.enabled}
              aria-disabled={!taperToggleEnabled}
              aria-label={t('binDesigner.overhang.taper.title')}
              tabIndex={taperToggleEnabled ? 0 : -1}
            >
              <span
                className={`text-xs leading-none ${taperToggleEnabled ? 'text-content-secondary' : 'text-content-disabled'}`}
              >
                {t('binDesigner.overhang.taper.title')}
              </span>
              <Checkbox checked={taper.enabled} disabled={!taperToggleEnabled} />
            </div>
            <p className="text-[11px] leading-relaxed text-content-tertiary">{t(taperHintKey)}</p>

            {taper.enabled && taper.canTaper && (
              <>
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.overhang.taper.profile')}
                  </span>
                  <SegmentedControl
                    options={profileOptions}
                    value={taper.profile}
                    onChange={handlers.setTaperProfile}
                    aria-label={t('binDesigner.overhang.taper.profile')}
                    size="sm"
                    fullWidth
                  />
                </div>
                <SliderInput
                  label={t('binDesigner.overhang.taper.bandHeight')}
                  value={taper.bandHeight}
                  onChange={handlers.setBandHeight}
                  min={DESIGNER_CONSTRAINTS.MIN_TAPER_BAND}
                  max={taper.maxBand}
                  step={DESIGNER_CONSTRAINTS.TAPER_BAND_STEP}
                  unit="mm"
                />
                {sides.map(({ side, label }) =>
                  taper.maxPerSide[side] > 0 ? (
                    <div
                      key={side}
                      onMouseEnter={() => handlers.setHovered(side)}
                      onMouseLeave={() => handlers.setHovered(null)}
                      onFocus={() => handlers.setHovered(side)}
                      onBlur={() => handlers.setHovered(null)}
                    >
                      <SliderInput
                        label={label}
                        value={taper.sides[side]}
                        onChange={(v) => handlers.setTaperSide(side, v)}
                        min={DESIGNER_CONSTRAINTS.MIN_TAPER}
                        max={taper.maxPerSide[side]}
                        step={DESIGNER_CONSTRAINTS.TAPER_STEP}
                        unit="mm"
                      />
                    </div>
                  ) : null
                )}
              </>
            )}
          </div>
        </>
      }
    />
  );
}
