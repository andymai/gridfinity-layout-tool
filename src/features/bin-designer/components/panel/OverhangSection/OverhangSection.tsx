/**
 * Overhang section: per-side outward body expansion (mm) + optional wall taper.
 *
 * Overhang grows the bin walls + stacking lip outward to fill the centering gap
 * a non-integral grid leaves in a drawer. Feet stay at the nominal footprint
 * (flat bottom under the overhang) unless the feet toggle is enabled. The taper
 * (#2933) adds a flare *on top of* that overhang: the base keeps the overhang
 * width and the wall angles outward to the rim, so a bin can reach into the
 * curved upper part of a drawer wall its base can't sit in. Flare is
 * independent of overhang — a side with no overhang can still flare, since the
 * base only ever stays at or above nominal. Composes with feet, which are framed
 * from the base overhang and so need one to exist.
 * A feature toggle gates the per-side controls; values are retained while off.
 * Suppressed for custom-shape bins.
 *
 * The flare's per-side sliders repeat the same four side names as the overhang
 * block above them, so they sit under their own heading.
 */

import { useId } from 'react';
import { Checkbox } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { FeatureToggle } from '../FeatureToggle';
import { OverhangSliderRow } from './OverhangSliderRow';
import { TaperProfileCards } from './TaperProfileCards';
import { useOverhangSection, type OverhangSide } from './useOverhangSection';

export function OverhangSection() {
  const { state, handlers, meta, t } = useOverhangSection();
  const taperSidesHeadingId = useId();

  const sides: { side: OverhangSide; label: string }[] = [
    { side: 'left', label: t('binDesigner.overhang.side.left') },
    { side: 'right', label: t('binDesigner.overhang.side.right') },
    { side: 'front', label: t('binDesigner.overhang.side.front') },
    { side: 'back', label: t('binDesigner.overhang.side.back') },
  ];

  const { taper } = state;
  // Feet need base overhang to stand on, but stay togglable while already on —
  // otherwise dragging the base to 0 strands them checked and un-uncheckable.
  const feetEnabled = state.hasBaseOverhang || state.feet;
  const taperToggleEnabled = taper.canTaper;
  const stacked = meta.stackedSliders;

  let taperHintKey = 'binDesigner.overhang.taper.hint';
  if (!taper.availableForBin) taperHintKey = 'binDesigner.overhang.taper.singleHollowOnly';

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
            // without touching the shared slider primitives (onFocus/onBlur
            // bubble from the inner input).
            <div
              key={side}
              onMouseEnter={() => handlers.setHovered(side)}
              onMouseLeave={() => handlers.setHovered(null)}
              onFocus={() => handlers.setHovered(side)}
              onBlur={() => handlers.setHovered(null)}
            >
              <OverhangSliderRow
                label={label}
                value={state.base[side]}
                onChange={(v) => handlers.setSide(side, v)}
                min={DESIGNER_CONSTRAINTS.MIN_OVERHANG}
                max={DESIGNER_CONSTRAINTS.MAX_OVERHANG}
                step={DESIGNER_CONSTRAINTS.OVERHANG_STEP}
                unit="mm"
                stacked={stacked}
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
                <TaperProfileCards
                  value={taper.profile}
                  onChange={handlers.setTaperProfile}
                  chamferLabel={t('binDesigner.overhang.taper.profileChamfer')}
                  filletLabel={t('binDesigner.overhang.taper.profileFillet')}
                  groupLabel={t('binDesigner.overhang.taper.profile')}
                />
                <OverhangSliderRow
                  label={t('binDesigner.overhang.taper.bandHeight')}
                  value={taper.bandHeight}
                  onChange={handlers.setBandHeight}
                  min={DESIGNER_CONSTRAINTS.MIN_TAPER_BAND}
                  max={taper.maxBand}
                  step={DESIGNER_CONSTRAINTS.TAPER_BAND_STEP}
                  unit="mm"
                  stacked={stacked}
                />

                {/* Labelled group: the four side names repeat the overhang
                    block above, so the heading has to be programmatically
                    attached, not just visually adjacent. */}
                <div
                  role="group"
                  aria-labelledby={taperSidesHeadingId}
                  className="flex flex-col gap-2"
                >
                  <p
                    id={taperSidesHeadingId}
                    className="mt-1 text-[11px] font-medium text-content-tertiary"
                  >
                    {t('binDesigner.overhang.taper.sidesHeading')}
                  </p>
                  {sides.map(({ side, label }) => (
                    <div
                      key={side}
                      onMouseEnter={() => handlers.setHovered(side)}
                      onMouseLeave={() => handlers.setHovered(null)}
                      onFocus={() => handlers.setHovered(side)}
                      onBlur={() => handlers.setHovered(null)}
                    >
                      <OverhangSliderRow
                        label={label}
                        srLabel={t('binDesigner.overhang.taper.sideAria', { side: label })}
                        value={taper.sides[side]}
                        onChange={(v) => handlers.setTaperSide(side, v)}
                        min={DESIGNER_CONSTRAINTS.MIN_TAPER}
                        max={taper.maxPerSide}
                        step={DESIGNER_CONSTRAINTS.TAPER_STEP}
                        unit="mm"
                        stacked={stacked}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      }
    />
  );
}
