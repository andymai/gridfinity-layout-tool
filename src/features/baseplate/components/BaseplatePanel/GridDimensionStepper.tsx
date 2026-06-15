import { CONSTRAINTS } from '@/core/constants';
import { Stepper } from '@/design-system/Stepper';

interface GridDimensionStepperProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly halfGridMode: boolean;
  readonly disabled: boolean;
}

/** Compact stepper for a custom grid width or depth dimension (grid units). */
export function GridDimensionStepper({
  label,
  value,
  onChange,
  halfGridMode,
  disabled,
}: GridDimensionStepperProps) {
  const step = halfGridMode ? 0.5 : 1;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-content-tertiary">{label}</span>
      <Stepper
        size="md"
        value={value}
        onChange={onChange}
        onStep={(delta) =>
          onChange(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, value + delta * step))
          )
        }
        disabled={disabled}
        min={CONSTRAINTS.GRID_MIN}
        max={CONSTRAINTS.GRID_MAX}
        step={step}
        aria-label={label}
      />
    </div>
  );
}
