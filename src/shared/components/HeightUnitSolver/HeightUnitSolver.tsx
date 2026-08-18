import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  solveUnitsUnderCeiling,
  stackedTotalMm,
  LIP_PROTRUSION_MM,
  STACK_JUNCTION_MM,
} from '@/shared/utils/heightUnits';

interface HeightUnitSolverProps {
  /** The layout's height unit in mm. Held fixed — this solver never rewrites it. */
  heightUnitMm: number;
  /** Measured internal drawer height in mm, or undefined when unmeasured. */
  ceilingMm: number | undefined;
  /**
   * Solid material the baseplate puts UNDER a seated stack (its floor depth,
   * 0 for the common no-magnet plate). The drawer-ceiling check charges every
   * column this rise, so the solver must budget under the same number or the
   * two adjacent panels contradict each other.
   */
  plateRiseMm?: number;
  variant?: 'desktop' | 'mobile';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Stack depths offered. Past three the bins are too short to be useful. */
const STACK_COUNTS = [1, 2, 3] as const;

/**
 * Which bin heights fit under the drawer, at the unit the layout already uses.
 *
 * Deliberately not the inverse of a target height. Solving for `heightUnitMm`
 * lands on the ceiling exactly but yields a non-standard unit, so the bins stop
 * stacking with stock Gridfinity — and it rewrites a global that every bin in
 * the layout reads. Holding the unit and reporting the tallest whole-unit bin
 * per stack depth answers the question without either cost; the leftover is
 * shown so dead space is a choice rather than a surprise.
 */
export function HeightUnitSolver({
  heightUnitMm,
  ceilingMm,
  plateRiseMm = 0,
  variant = 'desktop',
}: HeightUnitSolverProps) {
  const t = useTranslation();

  const rows = useMemo(
    () =>
      ceilingMm === undefined
        ? []
        : STACK_COUNTS.map((count) => {
            const budgetMm = ceilingMm - plateRiseMm;
            const units = solveUnitsUnderCeiling(budgetMm, heightUnitMm, count);
            if (units === null) return { count, units: null, totalMm: 0, slackMm: 0 };
            const totalMm = stackedTotalMm(units, heightUnitMm, count);
            return { count, units, totalMm, slackMm: budgetMm - totalMm };
          }),
    [ceilingMm, heightUnitMm, plateRiseMm]
  );

  const labelClass = variant === 'mobile' ? 'text-sm' : 'text-xs';

  if (ceilingMm === undefined) {
    return <p className={`text-content-tertiary ${labelClass}`}>{t('stackSolver.unmeasured')}</p>;
  }

  return (
    <div className={`space-y-2 ${labelClass}`}>
      <p className="text-content-tertiary">
        {t('stackSolver.description', {
          junction: round2(STACK_JUNCTION_MM),
          shortfall: round2(STACK_JUNCTION_MM - LIP_PROTRUSION_MM),
        })}
      </p>
      <p className="text-content-tertiary">
        {t('stackSolver.ceiling', {
          ceiling: round2(ceilingMm),
          unit: round2(heightUnitMm),
        })}
      </p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.count} className="flex items-baseline justify-between gap-2">
            <span className="text-content-secondary">
              {row.count === 1
                ? t('stackSolver.rowSingle')
                : t('stackSolver.rowStacked', { count: row.count })}
            </span>
            <span className={row.units === null ? 'text-content-disabled' : 'text-content-primary'}>
              {row.units === null
                ? t('stackSolver.rowNoFit')
                : t('stackSolver.rowFit', {
                    units: row.units,
                    total: round2(row.totalMm),
                    slack: round2(row.slackMm),
                  })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
