/**
 * Overhang section: per-side outward body expansion (mm).
 *
 * Grows the bin walls + stacking lip outward to fill the centering gap a
 * non-integral grid leaves in a drawer. Feet stay at the nominal footprint
 * (flat bottom under the overhang). Suppressed for custom-shape bins.
 */

import { SliderInput } from '@/shared/components/SliderInput';
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
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">
          {t('binDesigner.overhang.title')}
        </span>
        {meta.summary && (
          <span className="text-[11px] tabular-nums text-content-tertiary">{meta.summary}</span>
        )}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-content-tertiary">
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
        </div>
      </FeatureGate>
    </div>
  );
}
