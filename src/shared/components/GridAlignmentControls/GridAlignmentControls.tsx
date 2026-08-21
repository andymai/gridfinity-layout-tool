import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Stepper } from '@/design-system';
import { useLayoutStore } from '@/core/store';
import { effectiveGridUnitMmY, mm } from '@/core/types';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { drawerFrameShift } from '@/shared/utils/outlineFrame';

interface GridAlignmentControlsProps {
  /** Platform variant, matching the parent section's sizing. */
  variant?: 'desktop' | 'mobile';
}

const BUTTON_STEP_MM = 0.5;

/** Stored precision. The steppers and the hint both display at this many
 * decimals, so neither can show a value the frame doesn't apply. */
const SHIFT_DECIMALS = 2;

const roundMm = (v: number): number => Math.round(v * 100) / 100;

/** Sign-explicit mm value for the alignment hint, e.g. "+2.1" / "−0.75".
 * Rounds the magnitude, not the signed value: `Math.round` breaks ties toward
 * +∞, which rendered a stored −0.75 as "−0.7" while the stepper's own
 * formatter rounded the same magnitude up to "0.8". */
const fmtShift = (v: number): string => {
  const magnitude = Number(Math.abs(roundMm(v)).toFixed(SHIFT_DECIMALS));
  return v < 0 && magnitude !== 0 ? `−${magnitude}` : `+${magnitude}`;
};

/**
 * Grid↔perimeter alignment controls for a custom drawer shape.
 *
 * The hint reports the effective frame translation the layout and plate both
 * apply (automatic lattice registration minus the manual shift) — visible
 * whenever it is non-zero, so a shape drawn off-lattice explains why it sits
 * snapped on the grid. The steppers write `drawer.gridShiftX/Y` (mm, clamped
 * to ±half pitch — every shift beyond that is an equivalent whole-cell
 * registration) through the drawer.update command: undoable, and bins whose
 * sockets the re-based plate loses are displaced to staging.
 */
export function GridAlignmentControls({ variant = 'desktop' }: GridAlignmentControlsProps = {}) {
  const t = useTranslation();
  const mutations = useMutations();
  const { drawer, baseplateParams, gridUnitMm, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({
      drawer: s.layout.drawer,
      baseplateParams: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
    }))
  );

  const maxX = gridUnitMm / 2;
  const maxY = gridUnitMmY / 2;
  // Stored values can sit outside ±pitch/2 (imported/hand-edited layouts, or
  // a pitch change after the shift was set); the frame clamps them for
  // geometry, so clamp for display too or the control shows a shift the
  // plate doesn't apply.
  const shiftX = Math.max(-maxX, Math.min(maxX, drawer.gridShiftX ?? 0));
  const shiftY = Math.max(-maxY, Math.min(maxY, drawer.gridShiftY ?? 0));

  const setShift = useCallback(
    (axis: 'gridShiftX' | 'gridShiftY', value: number, limit: number) => {
      const clamped = roundMm(Math.max(-limit, Math.min(limit, value)));
      mutations.updateDrawer({ [axis]: mm(clamped) });
    },
    [mutations]
  );

  const handleReset = useCallback(() => {
    mutations.updateDrawer({ gridShiftX: mm(0), gridShiftY: mm(0) });
  }, [mutations]);

  // Hidden when the plate doesn't sync with the layout: the outline never
  // reaches the plate then, so there is no shared frame to align.
  if (drawer.outline === undefined || baseplateParams?.syncWithLayout === false) return null;

  const frame = drawerFrameShift(drawer, baseplateParams, gridUnitMm, gridUnitMmY);
  const hasFrameShift = frame.x !== 0 || frame.y !== 0;
  const hasManualShift = shiftX !== 0 || shiftY !== 0;
  const labelClass =
    variant === 'mobile' ? 'text-sm text-content-secondary' : 'text-xs text-content-secondary';

  return (
    <div className="space-y-1 pt-1">
      <div className="flex items-center justify-between gap-2">
        <span className={labelClass}>{t('drawerShape.gridAlignment.title')}</span>
        {hasManualShift && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleReset}
            className={variant === 'mobile' ? 'text-sm h-9 px-2' : 'text-xs h-7 px-2'}
          >
            {t('drawerShape.gridAlignment.reset')}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Stepper
          size="sm"
          value={shiftX}
          min={-maxX}
          max={maxX}
          step={BUTTON_STEP_MM}
          inputDecimals={SHIFT_DECIMALS}
          onChange={(v) => setShift('gridShiftX', v, maxX)}
          onStep={(delta) => setShift('gridShiftX', shiftX + delta * BUTTON_STEP_MM, maxX)}
          aria-label={t('drawerShape.gridAlignment.shiftX')}
          increaseLabel={t('drawerShape.gridAlignment.increase', {
            label: t('drawerShape.gridAlignment.shiftX'),
          })}
          decreaseLabel={t('drawerShape.gridAlignment.decrease', {
            label: t('drawerShape.gridAlignment.shiftX'),
          })}
        />
        <Stepper
          size="sm"
          value={shiftY}
          min={-maxY}
          max={maxY}
          step={BUTTON_STEP_MM}
          inputDecimals={SHIFT_DECIMALS}
          onChange={(v) => setShift('gridShiftY', v, maxY)}
          onStep={(delta) => setShift('gridShiftY', shiftY + delta * BUTTON_STEP_MM, maxY)}
          aria-label={t('drawerShape.gridAlignment.shiftY')}
          increaseLabel={t('drawerShape.gridAlignment.increase', {
            label: t('drawerShape.gridAlignment.shiftY'),
          })}
          decreaseLabel={t('drawerShape.gridAlignment.decrease', {
            label: t('drawerShape.gridAlignment.shiftY'),
          })}
        />
      </div>
      {hasFrameShift && (
        <p className="text-xs text-content-tertiary" data-testid="grid-alignment-hint">
          {t('drawerShape.gridAlignment.hint', { x: fmtShift(frame.x), y: fmtShift(frame.y) })}
        </p>
      )}
    </div>
  );
}
