/**
 * Finger access for the selected cutout. A slot or a round can itself be a
 * finger cut (with a curved or flat floor); any other pocket offers to place
 * one beside it.
 */

import type { Cutout, CutoutFingerBottom, CutoutShape } from '@/features/bin-designer/types';
import { CUTOUT_FINGER_BOTTOMS } from '@/features/bin-designer/types';
import { Button } from '@/design-system';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { FINGER_SHAPES, fingerBottom } from '@/shared/utils/fingerAccess';
import { useTranslation } from '@/i18n';
import {
  fingerAccessBlockedReason,
  switchFingerShape,
} from '../panel/CutoutsSection/fingerAccessPlan';

export interface FingerAccessControlsProps {
  readonly cutout: Cutout;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  /** Places a finger cut beside this pocket; absent where the editor cannot. */
  readonly onAdd?: () => void;
  readonly disabled?: boolean;
}

interface Choice<T extends string> {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly name: (option: T) => string;
  readonly onPick: (option: T) => void;
  readonly disabled: boolean;
}

function Segmented<T extends string>({ label, options, value, name, onPick, disabled }: Choice<T>) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_GROUP_CLASS}>
      {options.map((opt) => (
        <Button
          key={opt}
          type="button"
          variant="ghost"
          disabled={disabled}
          // Re-picking the active option would still push an undo entry.
          onClick={() => {
            if (opt !== value) onPick(opt);
          }}
          aria-pressed={value === opt}
          className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(value === opt)}`}
        >
          {name(opt)}
        </Button>
      ))}
    </div>
  );
}

export function FingerAccessControls({
  cutout,
  onUpdate,
  onAdd,
  disabled = false,
}: FingerAccessControlsProps) {
  const t = useTranslation();

  if (FINGER_SHAPES.includes(cutout.shape)) {
    const bottom = fingerBottom(cutout);
    return (
      <div className="space-y-1.5">
        <FeatureToggle
          label={t('binDesigner.cutouts.finger.name')}
          info={t('binDesigner.cutouts.finger.nameDetail')}
          checked={bottom !== null}
          onChange={() =>
            onUpdate(bottom === null ? { finger: { bottom: 'curved' } } : { finger: undefined })
          }
          disabled={disabled}
        />
        {bottom !== null && (
          <>
            <Segmented<CutoutShape>
              label={t('binDesigner.cutouts.finger.form')}
              options={FINGER_SHAPES}
              value={cutout.shape}
              name={(shape) => t(`binDesigner.cutouts.finger.form.${shape}`)}
              onPick={() => onUpdate(switchFingerShape(cutout))}
              disabled={disabled}
            />
            <Segmented<CutoutFingerBottom>
              label={t('binDesigner.cutouts.finger.bottom')}
              options={CUTOUT_FINGER_BOTTOMS}
              value={bottom}
              name={(b) => t(`binDesigner.cutouts.finger.bottom.${b}`)}
              onPick={(b) => onUpdate({ finger: { bottom: b } })}
              disabled={disabled}
            />
          </>
        )}
      </div>
    );
  }

  const blocked = fingerAccessBlockedReason(cutout);
  if (blocked === 'shape' || !onAdd) return null;
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={disabled || blocked !== null}
        onClick={onAdd}
      >
        {t('binDesigner.cutouts.finger.add')}
      </Button>
      <p className="text-micro text-content-tertiary">
        {t(
          blocked === 'repeat'
            ? 'binDesigner.cutouts.finger.repeatBlocked'
            : 'binDesigner.cutouts.finger.addHint'
        )}
      </p>
    </div>
  );
}
