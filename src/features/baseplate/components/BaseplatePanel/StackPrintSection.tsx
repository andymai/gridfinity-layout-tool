/**
 * "Stack for printing" panel section (experimental): stack a drawer's baseplates
 * into vertical towers separated by an air gap — bottom plate upright, the rest
 * flipped. Connectors, magnet holes, and corner rounding are auto-disabled by
 * the parent when this is enabled. Rendered as a plain (non-collapsible) block.
 */

import { useMemo } from 'react';
import { mm } from '@/core/types';
import type { Mm, StackPrintParams } from '@/core/types';
import {
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MIN_GAP_MM,
  STACK_PRINT_MAX_GAP_MM,
} from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { ExperimentalBadge } from '@/shared/components/ExperimentalBadge';
import { StackSampleButton } from './StackSampleButton';
import { Collapsible } from '@/design-system/Collapsible';
import { Stepper } from '@/design-system/Stepper';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { planPhysicalStacks, stackHeightCap, type StackGroup } from '../../utils/stackPrint';

interface StackPrintSectionProps {
  readonly stackPrint: StackPrintParams | undefined;
  /** Identical-piece groups the drawer needs (label + quantity). */
  readonly groups: readonly StackGroup[];
  readonly onChange: (next: StackPrintParams | undefined) => void;
}

/** Clamp + round a gap value to 0.1mm steps, absorbing button-click drift. */
function snapGap(value: number): Mm {
  const snapped = Math.round(value / 0.1) * 0.1;
  const clamped = Math.max(STACK_PRINT_MIN_GAP_MM, Math.min(STACK_PRINT_MAX_GAP_MM, snapped));
  return mm(Math.round(clamped * 100) / 100);
}

const DEFAULT_STACK_PRINT: StackPrintParams = {
  enabled: true,
  gapMm: mm(STACK_PRINT_DEFAULT_GAP_MM),
};

export function StackPrintSection({ stackPrint, groups, onChange }: StackPrintSectionProps) {
  const t = useTranslation();
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);
  const enabled = stackPrint?.enabled === true;
  const gapMm: Mm = stackPrint?.gapMm ?? mm(STACK_PRINT_DEFAULT_GAP_MM);

  const cap = stackHeightCap(maxPrintHeightMm, GRIDFINITY_SPEC.SOCKET_HEIGHT, gapMm);
  const plan = useMemo(
    () => (enabled ? planPhysicalStacks(groups, cap) : []),
    [enabled, groups, cap]
  );
  const totalCopies = plan.reduce((sum, s) => sum + s.copies, 0);

  const patch = (next: Partial<StackPrintParams>): void => {
    onChange({ enabled: true, gapMm, ...next });
  };

  return (
    <div className="border-b border-stroke-subtle px-4 py-3">
      <FeatureToggle
        label={t('baseplate.stackPrint.enable')}
        badge={<ExperimentalBadge />}
        checked={enabled}
        onChange={() => onChange(enabled ? undefined : DEFAULT_STACK_PRINT)}
        primaryControls={
          <>
            <p className="text-[11px] leading-relaxed text-content-secondary">
              {t('baseplate.stackPrint.hint')}
            </p>

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

            <p className="text-[11px] text-content-tertiary">
              {t(
                plan.length === 1
                  ? 'baseplate.stackPrint.stacks.one'
                  : 'baseplate.stackPrint.stacks.other',
                { count: plan.length }
              )}
              {' · '}
              {t(
                totalCopies === 1
                  ? 'baseplate.stackPrint.plates.one'
                  : 'baseplate.stackPrint.plates.other',
                { count: totalCopies }
              )}
            </p>

            <p className="text-[11px] leading-relaxed text-content-tertiary">
              {t('baseplate.stackPrint.featuresOff')}
            </p>

            <Collapsible
              title={t('baseplate.stackPrint.multiMaterial.title')}
              size="sm"
              defaultExpanded={false}
            >
              <div className="space-y-2 text-[11px] leading-relaxed text-content-secondary">
                <p>{t('baseplate.stackPrint.multiMaterial.intro')}</p>
                <p>{t('baseplate.stackPrint.multiMaterial.prusa')}</p>
                <p>{t('baseplate.stackPrint.multiMaterial.bambu')}</p>
              </div>
            </Collapsible>

            <StackSampleButton />
          </>
        }
      />
    </div>
  );
}
