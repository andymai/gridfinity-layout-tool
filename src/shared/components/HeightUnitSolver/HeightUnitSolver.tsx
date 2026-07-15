import { useId, useState } from 'react';
import { CONSTRAINTS } from '@/core/constants';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { solveHeightUnitMm, stackedTotalMm, STACK_LIP_MM } from '@/shared/utils/heightUnits';
// Relative, not via the '@/shared/components' barrel — this file is inside it.
import { SettingsRow } from '../SettingsRow';

interface HeightUnitSolverProps {
  /** Current height unit in mm — the value Apply overwrites. */
  heightUnitMm: number;
  /** Called with the solved unit value when the user applies a suggestion. */
  onApply: (heightUnitMm: number) => void;
  variant?: 'desktop' | 'mobile';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Example target height shown as input placeholder (a number, not UI copy). */
const TARGET_PLACEHOLDER_MM = '75.6';

/**
 * Back-solves `heightUnitMm` from a target stack height. Bins nest when stacked
 * (pitch = body height), so a stack of `bins`, each `unitsPerBin` tall, prints
 * to `bins × unitsPerBin × unit + one lip`. This inverts that to answer the
 * reporter's ask (#2416): "what unit size fills my drawer with N bins?".
 */
export function HeightUnitSolver({
  heightUnitMm,
  onApply,
  variant = 'desktop',
}: HeightUnitSolverProps) {
  const t = useTranslation();
  const uid = useId();
  const [target, setTarget] = useState('');
  const [bins, setBins] = useState(2);
  const [unitsPerBin, setUnitsPerBin] = useState(2);

  const targetMm = Number.parseFloat(target);
  const solved =
    Number.isFinite(targetMm) && targetMm > 0
      ? solveHeightUnitMm(targetMm, unitsPerBin, bins)
      : null;
  // Range-check the value we actually apply (`suggested`), not the unrounded
  // solve — otherwise 20.004 hides Apply though it rounds to an in-range 20.00.
  const suggested = solved !== null ? round2(solved) : null;
  const inRange =
    suggested !== null &&
    suggested >= CONSTRAINTS.HEIGHT_UNIT_MM_MIN &&
    suggested <= CONSTRAINTS.HEIGHT_UNIT_MM_MAX;
  const stackTotalMm =
    suggested !== null ? round2(stackedTotalMm(unitsPerBin, suggested, bins)) : 0;

  const inputClass =
    variant === 'mobile'
      ? 'input w-20 h-10 text-center'
      : 'input w-14 py-0.5 px-1 text-xs text-right';

  // Raw inputs rather than DeferredNumberInput: the solve previews live as you
  // type, and `target` starts empty (no suggestion until asked), neither of
  // which a commit-on-blur numeric input can express.
  return (
    <div className="space-y-2 text-xs">
      <p className="text-content-tertiary">
        {t('stackSolver.description', { lip: round2(STACK_LIP_MM) })}
      </p>
      <SettingsRow label={t('stackSolver.targetLabel')} htmlFor={`${uid}-target`} variant={variant}>
        <input
          id={`${uid}-target`}
          type="number"
          inputMode="decimal"
          step="any"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={TARGET_PLACEHOLDER_MM}
          className={inputClass}
          aria-label={t('stackSolver.targetLabel')}
        />
      </SettingsRow>
      <SettingsRow label={t('stackSolver.binsLabel')} htmlFor={`${uid}-bins`} variant={variant}>
        <input
          id={`${uid}-bins`}
          type="number"
          min={1}
          step={1}
          value={bins}
          onChange={(e) => setBins(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          className={inputClass}
          aria-label={t('stackSolver.binsLabel')}
        />
      </SettingsRow>
      <SettingsRow
        label={t('stackSolver.unitsPerBinLabel')}
        htmlFor={`${uid}-units`}
        variant={variant}
      >
        <input
          id={`${uid}-units`}
          type="number"
          min={1}
          step={1}
          value={unitsPerBin}
          onChange={(e) => setUnitsPerBin(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          className={inputClass}
          aria-label={t('stackSolver.unitsPerBinLabel')}
        />
      </SettingsRow>

      {suggested !== null && (
        <div className="space-y-1 pt-1">
          <div className="text-content-secondary">
            {t('stackSolver.result', { total: stackTotalMm })}
          </div>
          {inRange ? (
            <Button
              variant="secondary"
              fullWidth
              type="button"
              onClick={() => onApply(suggested)}
              disabled={Math.abs(suggested - heightUnitMm) < 1e-9}
              className="text-[11px] py-1.5 px-2"
            >
              {t('stackSolver.apply', { unit: suggested })}
            </Button>
          ) : (
            <div className="text-warning">
              {t('stackSolver.outOfRange', {
                min: CONSTRAINTS.HEIGHT_UNIT_MM_MIN,
                max: CONSTRAINTS.HEIGHT_UNIT_MM_MAX,
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
