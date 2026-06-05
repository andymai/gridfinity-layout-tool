/**
 * Labelled stepper field shared by feature panels. Standardizes the label +
 * inline-unit treatment (e.g. "Height (mm)") above a StepperControl so every
 * numeric field across the bin-designer panels reads identically and is
 * self-documenting about its unit.
 */

import type { ComponentProps } from 'react';
import { StepperControl } from '@/shared/components/StepperControl';

type StepperFieldProps = ComponentProps<typeof StepperControl> & {
  label: string;
  /** Unit rendered inline in the label, e.g. '%' or 'mm'. */
  unit?: string;
};

export function StepperField({ label, unit, ...stepper }: StepperFieldProps) {
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1 block text-xs text-content-tertiary">
        {label}
        {unit ? <span className="text-content-tertiary/70">{` (${unit})`}</span> : null}
      </span>
      <StepperControl {...stepper} />
    </div>
  );
}
