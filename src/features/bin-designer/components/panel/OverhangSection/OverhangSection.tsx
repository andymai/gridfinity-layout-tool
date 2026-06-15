/**
 * Overhang section: per-side outward body expansion (mm).
 *
 * Grows the bin walls + stacking lip outward to fill the centering gap a
 * non-integral grid leaves in a drawer. Feet stay at the nominal footprint
 * (flat bottom under the overhang) unless the feet toggle is enabled. A feature
 * toggle gates the per-side controls; per-side values are retained while off.
 * Suppressed for custom-shape bins.
 */

import { Checkbox, SliderInput } from '@/design-system';
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
            onMouseEnter={state.hasOverhang ? () => handlers.setHovered('feet') : undefined}
            onMouseLeave={state.hasOverhang ? () => handlers.setHovered(null) : undefined}
            onFocus={state.hasOverhang ? () => handlers.setHovered('feet') : undefined}
            onBlur={state.hasOverhang ? () => handlers.setHovered(null) : undefined}
            onClick={state.hasOverhang ? handlers.toggleFeet : undefined}
            onKeyDown={(e) => {
              if (state.hasOverhang && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handlers.toggleFeet();
              }
            }}
            role="checkbox"
            aria-checked={state.feet}
            aria-disabled={!state.hasOverhang}
            aria-label={t('binDesigner.overhang.feet')}
            tabIndex={state.hasOverhang ? 0 : -1}
          >
            <span
              className={`text-xs leading-none ${state.hasOverhang ? 'text-content-secondary' : 'text-content-disabled'}`}
            >
              {t('binDesigner.overhang.feet')}
            </span>
            <Checkbox checked={state.feet} disabled={!state.hasOverhang} />
          </div>
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.overhang.feetHint')}
          </p>
        </>
      }
    />
  );
}
