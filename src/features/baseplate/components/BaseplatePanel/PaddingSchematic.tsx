import { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { PaddingStepper } from '../PaddingStepper';
import { PaddingAnchor } from '../PaddingAnchor';
import type { BaseplateParams, PaddingAnchor as PaddingAnchorValue } from '@/core/types';
import { mm } from '@/core/types';
import { computeAnchoredPaddings } from '@/features/baseplate/utils/computeAnchoredPaddings';

type PaddingKey = 'paddingLeft' | 'paddingRight' | 'paddingFront' | 'paddingBack';

interface PaddingSchematicProps {
  readonly baseplateParams: BaseplateParams;
  readonly updateParam: <K extends keyof BaseplateParams>(
    key: K,
    value: BaseplateParams[K]
  ) => void;
  readonly updateParams: (patch: Partial<BaseplateParams>) => void;
}

export function PaddingSchematic({
  baseplateParams,
  updateParam,
  updateParams,
}: PaddingSchematicProps) {
  const t = useTranslation();
  const anchor = baseplateParams.paddingAnchor ?? 'custom';

  const handleAnchorChange = useCallback(
    (next: Exclude<PaddingAnchorValue, 'custom'>) => {
      const distributed = computeAnchoredPaddings(baseplateParams, next);
      updateParams({
        paddingLeft: distributed.paddingLeft,
        paddingRight: distributed.paddingRight,
        paddingFront: distributed.paddingFront,
        paddingBack: distributed.paddingBack,
        paddingAnchor: next,
      });
    },
    [baseplateParams, updateParams]
  );

  const handlePaddingChange = useCallback(
    (key: PaddingKey, value: number) => {
      if (anchor === 'custom') {
        updateParam(key, mm(value));
      } else {
        updateParams({ [key]: mm(value), paddingAnchor: 'custom' });
      }
    },
    [anchor, updateParam, updateParams]
  );

  const totalPadding =
    baseplateParams.paddingLeft +
    baseplateParams.paddingRight +
    baseplateParams.paddingFront +
    baseplateParams.paddingBack;
  const showClampWarning =
    anchor !== 'custom' &&
    totalPadding > 0 &&
    computeAnchoredPaddings(baseplateParams, anchor).clamped;

  return (
    <div className="space-y-1">
      <div className="flex justify-center">
        <PaddingStepper
          orientation="horizontal"
          label={t('baseplate.paddingBack')}
          aria-label={t('baseplate.paddingBack')}
          value={baseplateParams.paddingBack}
          onChange={(v) => handlePaddingChange('paddingBack', v)}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <PaddingStepper
          orientation="vertical"
          aria-label={t('baseplate.paddingLeft')}
          value={baseplateParams.paddingLeft}
          onChange={(v) => handlePaddingChange('paddingLeft', v)}
        />
        <div className="flex-1 min-h-16 rounded border border-dashed border-stroke-subtle bg-surface-secondary/50">
          <PaddingAnchor
            value={anchor}
            onChange={handleAnchorChange}
            showClampWarning={showClampWarning}
          />
        </div>
        <PaddingStepper
          orientation="vertical"
          aria-label={t('baseplate.paddingRight')}
          value={baseplateParams.paddingRight}
          onChange={(v) => handlePaddingChange('paddingRight', v)}
        />
      </div>

      <div className="flex justify-center">
        <PaddingStepper
          orientation="horizontal"
          label={t('baseplate.paddingFront')}
          aria-label={t('baseplate.paddingFront')}
          value={baseplateParams.paddingFront}
          onChange={(v) => handlePaddingChange('paddingFront', v)}
        />
      </div>
    </div>
  );
}
