import { useCallback, useState } from 'react';
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

  // The clamp flag must come from the redistribution result — checking
  // post-write state always reports `clamped: false` because clamped values
  // are stable under another anchor split.
  const [showClampWarning, setShowClampWarning] = useState(false);

  const handleAnchorChange = useCallback(
    (next: Exclude<PaddingAnchorValue, 'custom'>) => {
      const distributed = computeAnchoredPaddings(baseplateParams, next);
      setShowClampWarning(distributed.clamped);
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
      setShowClampWarning(false);
      if (anchor === 'custom') {
        updateParam(key, mm(value));
      } else {
        updateParams({ [key]: mm(value), paddingAnchor: 'custom' });
      }
    },
    [anchor, updateParam, updateParams]
  );

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

      <div className="flex items-stretch gap-1.5">
        <PaddingStepper
          orientation="vertical"
          label={t('baseplate.paddingLeft')}
          aria-label={t('baseplate.paddingLeft')}
          value={baseplateParams.paddingLeft}
          onChange={(v) => handlePaddingChange('paddingLeft', v)}
        />
        <div className="flex flex-1 flex-col justify-center rounded-md border border-stroke-subtle bg-surface-secondary/50">
          <div className="flex-1">
            <PaddingAnchor
              value={anchor}
              onChange={handleAnchorChange}
              showClampWarning={showClampWarning}
            />
          </div>
          <div role="status" aria-live="polite" aria-atomic className="sr-only">
            {/* Non-breaking space (not '') keeps the row height without making the
                live region announce a blank update when the anchor leaves custom. */}
            {anchor === 'custom' ? t('baseplate.paddingAnchor.custom') : ' '}
          </div>
        </div>
        <PaddingStepper
          orientation="vertical"
          label={t('baseplate.paddingRight')}
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
