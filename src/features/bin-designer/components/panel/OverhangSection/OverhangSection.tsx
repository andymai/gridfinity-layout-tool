/**
 * Overhang section: per-side outward body expansion (mm).
 *
 * Grows the bin walls + stacking lip outward to fill the centering gap a
 * non-integral grid leaves in a drawer. Feet stay at the nominal footprint
 * (flat bottom under the overhang) unless the feet toggle is enabled.
 * Collapsed by default — a niche/advanced control. Suppressed for custom-shape
 * bins.
 */

import { SliderInput } from '@/shared/components/SliderInput';
import { Checkbox } from '@/shared/components/Checkbox';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { FeatureGate } from '../FeatureGate';
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
    <CollapsibleSection
      title={t('binDesigner.overhang.title')}
      variant="small"
      defaultExpanded={false}
      summary={meta.summary}
    >
      <p className="mb-3 mt-1 text-[11px] leading-relaxed text-content-tertiary">
        {t('binDesigner.overhang.hint')}
      </p>
      <FeatureGate disabled={state.isCustomShape} reason={meta.disabledReason ?? ''}>
        <div className="space-y-3">
          {sides.map(({ side, label }) => (
            <SliderInput
              key={side}
              label={label}
              value={state.overhang[side]}
              onChange={(v) => handlers.setSide(side, v)}
              min={DESIGNER_CONSTRAINTS.MIN_OVERHANG}
              max={DESIGNER_CONSTRAINTS.MAX_OVERHANG}
              step={DESIGNER_CONSTRAINTS.OVERHANG_STEP}
              unit="mm"
            />
          ))}
          <div
            className="group flex cursor-pointer items-center justify-between pt-1"
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
        </div>
      </FeatureGate>
    </CollapsibleSection>
  );
}
