/**
 * Spatial schematic showing four padding steppers positioned around a baseplate rectangle.
 * Back is above, Front below, Left/Right flank a dashed placeholder for the baseplate body.
 */

import { useTranslation } from '@/i18n';
import { PaddingStepper } from '../PaddingStepper';
import type { BaseplateParams } from '@/core/types';
import { mm } from '@/core/types';

interface PaddingSchematicProps {
  readonly baseplateParams: BaseplateParams;
  readonly updateParam: <K extends keyof BaseplateParams>(
    key: K,
    value: BaseplateParams[K]
  ) => void;
}

export function PaddingSchematic({ baseplateParams, updateParam }: PaddingSchematicProps) {
  const t = useTranslation();

  return (
    <div className="space-y-1">
      <div className="flex justify-center">
        <PaddingStepper
          orientation="horizontal"
          label={t('baseplate.paddingBack')}
          aria-label={t('baseplate.paddingBack')}
          value={baseplateParams.paddingBack}
          onChange={(v) => updateParam('paddingBack', mm(v))}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <PaddingStepper
          orientation="vertical"
          aria-label={t('baseplate.paddingLeft')}
          value={baseplateParams.paddingLeft}
          onChange={(v) => updateParam('paddingLeft', mm(v))}
        />
        <div className="flex-1 min-h-12 rounded border border-dashed border-stroke-subtle bg-surface-secondary/50" />
        <PaddingStepper
          orientation="vertical"
          aria-label={t('baseplate.paddingRight')}
          value={baseplateParams.paddingRight}
          onChange={(v) => updateParam('paddingRight', mm(v))}
        />
      </div>

      <div className="flex justify-center">
        <PaddingStepper
          orientation="horizontal"
          label={t('baseplate.paddingFront')}
          aria-label={t('baseplate.paddingFront')}
          value={baseplateParams.paddingFront}
          onChange={(v) => updateParam('paddingFront', mm(v))}
        />
      </div>
    </div>
  );
}
