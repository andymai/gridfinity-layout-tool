/**
 * "Stack for printing" panel section: stack a drawer's baseplates
 * into vertical towers separated by an air gap — bottom plate upright, the rest
 * flipped. Magnet holes and corner rounding are auto-disabled by the parent when
 * this is enabled (they bridge / break tile uniformity under the flip); dovetail
 * connectors are kept, only snap clip is disabled. Rendered as a plain
 * (non-collapsible) block.
 */

import { mm } from '@/core/types';
import type { Mm, StackPrintParams } from '@/core/types';
import {
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MIN_GAP_MM,
  STACK_PRINT_MAX_GAP_MM,
  STACK_PRINT_DEFAULT_COPIES,
  STACK_PRINT_MIN_COPIES,
  STACK_PRINT_MAX_COPIES,
} from '@/core/types';
import type { PhysicalStack, StackPrintStatus } from '../../utils/stackPrint';
import { useTranslation } from '@/i18n';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { StackSampleButton } from './StackSampleButton';
import { Stepper } from '@/design-system/Stepper';
import { Alert } from '@/design-system/Alert';
import { AlertTriangleIcon, CheckIcon } from '@/design-system/Icon';
import { useStackPrintStatus } from '../../hooks/useStackPrintStatus';
interface StackPrintSectionProps {
  readonly stackPrint: StackPrintParams | undefined;
  readonly onChange: (next: StackPrintParams | undefined) => void;
}

/** Clamp + round a gap value to 0.1mm steps, absorbing button-click drift. */
function snapGap(value: number): Mm {
  const snapped = Math.round(value / 0.1) * 0.1;
  const clamped = Math.max(STACK_PRINT_MIN_GAP_MM, Math.min(STACK_PRINT_MAX_GAP_MM, snapped));
  return mm(Math.round(clamped * 100) / 100);
}

/** Clamp the copy multiplier to a whole number within the supported range. */
function snapCopies(value: number): number {
  return Math.max(STACK_PRINT_MIN_COPIES, Math.min(STACK_PRINT_MAX_COPIES, Math.round(value)));
}

const DEFAULT_STACK_PRINT: StackPrintParams = {
  enabled: true,
  gapMm: mm(STACK_PRINT_DEFAULT_GAP_MM),
  copies: STACK_PRINT_DEFAULT_COPIES,
};

/**
 * Summarise the print output (total plates + file count) so a stack that
 * auto-splits across the build-height cap isn't surprising. Returns null when
 * there's nothing to stack (≤1 plate) — the warnings already cover that.
 */
function stackOutputSummary(
  t: ReturnType<typeof useTranslation>,
  plan: readonly PhysicalStack[]
): string | null {
  const plates = plan.reduce((sum, p) => sum + p.copies, 0);
  if (plates < 2) return null;
  const files = plan.length;
  if (files <= 1) return t('baseplate.stackPrint.output.oneFile', { plates });
  const breakdown = plan.map((p) => p.copies).join('+');
  return t('baseplate.stackPrint.output.manyFiles', { plates, files, breakdown });
}

/** Translate a non-`ok` stack-print status into a user-facing warning string. */
function stackWarning(
  t: ReturnType<typeof useTranslation>,
  status: StackPrintStatus,
  gapMm: number,
  maxPrintHeightMm: number
): string | null {
  switch (status.kind) {
    case 'ok':
      return null;
    case 'singlePlate':
      return t('baseplate.stackPrint.warning.singlePlate');
    case 'buildHeightCapped':
      return t('baseplate.stackPrint.warning.buildHeightCapped', {
        gap: gapMm.toFixed(1),
        maxHeight: Math.round(maxPrintHeightMm),
      });
    case 'plateTooTall':
      return t('baseplate.stackPrint.warning.plateTooTall', {
        maxHeight: Math.round(maxPrintHeightMm),
      });
  }
}

export function StackPrintSection({ stackPrint, onChange }: StackPrintSectionProps) {
  const t = useTranslation();
  const enabled = stackPrint?.enabled === true;
  const gapMm: Mm = stackPrint?.gapMm ?? mm(STACK_PRINT_DEFAULT_GAP_MM);
  const copies = stackPrint?.copies ?? STACK_PRINT_DEFAULT_COPIES;

  const { status, maxPrintHeightMm, plan } = useStackPrintStatus(gapMm);
  // Gate on `enabled` so the warning never surfaces while stacking is off, rather
  // than relying on FeatureToggle hiding the controls.
  const warning = enabled ? stackWarning(t, status, gapMm, maxPrintHeightMm) : null;
  const outputSummary = enabled && !warning ? stackOutputSummary(t, plan) : null;

  const patch = (next: Partial<StackPrintParams>): void => {
    onChange({ enabled: true, gapMm, copies, ...next });
  };

  return (
    <div className="border-b border-stroke-subtle px-4 py-3">
      <FeatureToggle
        label={t('baseplate.stackPrint.enable')}
        checked={enabled}
        onChange={() => onChange(enabled ? undefined : DEFAULT_STACK_PRINT)}
        primaryControls={
          <>
            {warning && (
              <Alert intent="warning" icon={<AlertTriangleIcon size="sm" />}>
                {warning}
              </Alert>
            )}

            <p className="text-[11px] leading-relaxed text-content-secondary">
              {t('baseplate.stackPrint.hint')}
            </p>

            <SettingsRow
              label={t('baseplate.stackPrint.copies.label')}
              tooltip={t('baseplate.stackPrint.copies.info')}
            >
              <Stepper
                size="sm"
                value={copies}
                onStep={(delta) => patch({ copies: snapCopies(copies + delta) })}
                min={STACK_PRINT_MIN_COPIES}
                max={STACK_PRINT_MAX_COPIES}
                step={1}
                inputDecimals={0}
                displayValue={String(copies)}
                aria-label={t('baseplate.stackPrint.copies.label')}
              />
            </SettingsRow>

            <SettingsRow
              label={t('baseplate.stackPrint.gap.label')}
              tooltip={t('baseplate.stackPrint.gap.info')}
              unit="mm"
            >
              <Stepper
                size="sm"
                value={gapMm}
                onStep={(delta) => patch({ gapMm: snapGap(gapMm + delta * 0.1) })}
                min={STACK_PRINT_MIN_GAP_MM}
                max={STACK_PRINT_MAX_GAP_MM}
                step={0.1}
                inputDecimals={1}
                displayValue={gapMm.toFixed(1)}
                aria-label={t('baseplate.stackPrint.gap.label')}
              />
            </SettingsRow>

            {outputSummary && (
              <Alert intent="success" icon={<CheckIcon size="sm" />}>
                {outputSummary}
              </Alert>
            )}

            <div className="space-y-2 rounded border border-info/30 bg-info-muted px-2.5 py-2 text-[11px] leading-relaxed text-content-secondary">
              <p className="font-semibold text-info">{t('baseplate.stackPrint.tips.heading')}</p>
              <div className="space-y-0.5">
                <p className="font-medium text-content">
                  {t('baseplate.stackPrint.tips.single.heading')}
                </p>
                <p>{t('baseplate.stackPrint.tips.single.body')}</p>
              </div>
              <div className="space-y-0.5">
                <p className="font-medium text-content">
                  {t('baseplate.stackPrint.tips.multi.heading')}
                </p>
                <p>{t('baseplate.stackPrint.tips.multi.body')}</p>
                <p>
                  <strong>PrusaSlicer</strong> {t('baseplate.stackPrint.tips.multi.prusa')}
                </p>
                <p>
                  <strong>Bambu / Orca</strong> {t('baseplate.stackPrint.tips.multi.bambu')}
                </p>
              </div>
            </div>

            <StackSampleButton />
          </>
        }
      />
    </div>
  );
}
