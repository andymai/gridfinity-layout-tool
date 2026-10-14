/**
 * Labelled stepper field shared by feature panels. Standardizes the label +
 * inline-unit treatment (e.g. "Height (mm)") above a Stepper so every
 * numeric field across the bin-designer panels reads identically and is
 * self-documenting about its unit.
 */

import type { ComponentProps } from 'react';
import { Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { InfoDot } from '@/shared/components/InfoDot';

type StepperFieldProps = ComponentProps<typeof Stepper> & {
  label: string;
  /** Unit rendered inline in the label, e.g. '%' or 'mm'. */
  unit?: string;
  /** Explanatory prose offered behind an info dot beside the label. */
  info?: string;
  /** Accessible name for the info dot; defaults to "About {label}". */
  infoLabel?: string;
};

export function StepperField({ label, unit, info, infoLabel, ...stepper }: StepperFieldProps) {
  const t = useTranslation();
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1 flex items-center gap-1.5 text-label text-content-tertiary">
        <span>
          {label}
          {unit ? <span className="text-content-tertiary/70">{` (${unit})`}</span> : null}
        </span>
        {info !== undefined && (
          <InfoDot aria-label={infoLabel ?? t('common.aboutLabel', { label })}>
            <p>{info}</p>
          </InfoDot>
        )}
      </span>
      <Stepper {...stepper} />
    </div>
  );
}
