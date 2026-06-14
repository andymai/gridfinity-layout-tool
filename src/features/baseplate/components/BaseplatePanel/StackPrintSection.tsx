/**
 * "Stack for printing" panel section (experimental): stack a drawer's baseplates
 * into vertical towers separated by an air gap or sacrificial sheet, printed
 * upside down. Connectors are auto-disabled by the parent when this is enabled.
 */

import { useMemo } from 'react';
import { mm } from '@/core/types';
import type { Mm, StackPrintParams, StackPrintMode } from '@/core/types';
import {
  STACK_PRINT_DEFAULT_SETS,
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MIN_SETS,
  STACK_PRINT_MAX_SETS,
  STACK_PRINT_MIN_GAP_MM,
  STACK_PRINT_MAX_GAP_MM,
} from '@/core/types';
import { FILAMENT_COLORS } from '@/core/constants';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { Select } from '@/design-system/Select';
import { Stepper } from '@/design-system/Stepper';
import { planPhysicalStacks, type StackGroup } from '../../utils/stackPrint';

interface StackPrintSectionProps {
  readonly stackPrint: StackPrintParams | undefined;
  /** Identical-piece groups the drawer needs (label + quantity). */
  readonly groups: readonly StackGroup[];
  /** Whether the plate is split (drives the connector-disabled warning). */
  readonly isSplit: boolean;
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
  sets: STACK_PRINT_DEFAULT_SETS,
  gapMm: mm(STACK_PRINT_DEFAULT_GAP_MM),
  mode: 'airGap',
};

export function StackPrintSection({
  stackPrint,
  groups,
  isSplit,
  onChange,
}: StackPrintSectionProps) {
  const t = useTranslation();
  const separatorColor = useSettingsStore((s) => s.settings.baseplateSeparatorColor);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const enabled = stackPrint?.enabled === true;
  const sets = stackPrint?.sets ?? STACK_PRINT_DEFAULT_SETS;
  const gapMm: Mm = stackPrint?.gapMm ?? mm(STACK_PRINT_DEFAULT_GAP_MM);
  const mode: StackPrintMode = stackPrint?.mode ?? 'airGap';
  const isSheet = mode === 'sacrificialSheet';
  const gapLabel = t(
    isSheet ? 'baseplate.stackPrint.sheet.label' : 'baseplate.stackPrint.gap.label'
  );
  const gapInfo = t(isSheet ? 'baseplate.stackPrint.sheet.info' : 'baseplate.stackPrint.gap.info');

  const plan = useMemo(
    () => (enabled ? planPhysicalStacks(groups, sets) : []),
    [enabled, groups, sets]
  );
  const totalCopies = plan.reduce((sum, s) => sum + s.copies, 0);
  const summary = enabled
    ? t('baseplate.stackPrint.summary', { stacks: plan.length, plates: totalCopies })
    : undefined;

  const patch = (next: Partial<StackPrintParams>): void => {
    onChange({ enabled: true, sets, gapMm, mode, ...next });
  };

  return (
    <StickyGroupHeader
      title={t('baseplate.stackPrint.section')}
      badge={t('baseplate.stackPrint.badge')}
      summary={summary}
    >
      <div className="space-y-3 px-4 py-3">
        <FeatureToggle
          label={t('baseplate.stackPrint.enable')}
          checked={enabled}
          onChange={() => onChange(enabled ? undefined : DEFAULT_STACK_PRINT)}
          primaryControls={
            enabled ? (
              <div className="mt-1.5 space-y-3">
                <p className="text-[11px] leading-relaxed text-content-tertiary">
                  {t('baseplate.stackPrint.hint')}
                </p>

                <SettingsRow
                  label={t('baseplate.stackPrint.mode.label')}
                  tooltip={t('baseplate.stackPrint.mode.info')}
                >
                  <Select
                    size="sm"
                    value={mode}
                    onValueChange={(v) => patch({ mode: v as StackPrintMode })}
                    options={[
                      { id: 'airGap', name: t('baseplate.stackPrint.mode.airGap') },
                      {
                        id: 'sacrificialSheet',
                        name: t('baseplate.stackPrint.mode.sacrificialSheet'),
                      },
                    ]}
                    aria-label={t('baseplate.stackPrint.mode.label')}
                  />
                </SettingsRow>

                <SettingsRow
                  label={t('baseplate.stackPrint.sets.label')}
                  tooltip={t('baseplate.stackPrint.sets.info')}
                >
                  <Stepper
                    size="sm"
                    value={sets}
                    onStep={(delta) =>
                      patch({
                        sets: Math.max(
                          STACK_PRINT_MIN_SETS,
                          Math.min(STACK_PRINT_MAX_SETS, sets + delta)
                        ),
                      })
                    }
                    min={STACK_PRINT_MIN_SETS}
                    max={STACK_PRINT_MAX_SETS}
                    step={1}
                    displayValue={`${sets}`}
                    aria-label={t('baseplate.stackPrint.sets.label')}
                  />
                </SettingsRow>

                <SettingsRow label={gapLabel} tooltip={gapInfo} unit="mm">
                  <Stepper
                    size="sm"
                    value={gapMm}
                    onStep={(delta) => patch({ gapMm: snapGap(gapMm + delta * 0.1) })}
                    min={STACK_PRINT_MIN_GAP_MM}
                    max={STACK_PRINT_MAX_GAP_MM}
                    step={0.1}
                    inputDecimals={1}
                    displayValue={`${gapMm.toFixed(1)} mm`}
                    aria-label={gapLabel}
                  />
                </SettingsRow>

                {mode === 'sacrificialSheet' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-content-secondary">
                      {t('baseplate.stackPrint.separatorColor')}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5" role="listbox">
                      {FILAMENT_COLORS.map(({ color, nameKey }) => (
                        <button
                          key={color}
                          type="button"
                          role="option"
                          aria-selected={separatorColor === color}
                          aria-label={t('colors.colorAriaLabel', { name: t(nameKey) })}
                          onClick={() => updateSetting('baseplateSeparatorColor', color)}
                          className={`rounded-md p-0.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
                            separatorColor === color ? 'bg-surface-hover ring-2 ring-accent' : ''
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded border transition-transform hover:scale-105 ${
                              separatorColor === color ? 'border-accent' : 'border-stroke-subtle/50'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isSplit && (
                  <div className="rounded bg-warning/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-warning">
                    {t('baseplate.stackPrint.connectorsDisabled')}
                  </div>
                )}
                {mode === 'sacrificialSheet' && (
                  <div className="rounded bg-info/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-info">
                    {t('baseplate.stackPrint.needs3mf')}
                  </div>
                )}
              </div>
            ) : undefined
          }
        />
      </div>
    </StickyGroupHeader>
  );
}
