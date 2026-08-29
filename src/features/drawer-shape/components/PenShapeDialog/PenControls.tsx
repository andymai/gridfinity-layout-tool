/**
 * The pen editor's control row: snap increment, the selected corner's exact
 * coordinates, per-corner rounding, and the sketch actions.
 *
 * Split out so the dialog stays inside the file line cap; every piece of state
 * still belongs to the dialog and arrives as props.
 */

import { Button, SegmentedControl, Stepper, NumberField } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SNAP_FRACTIONS, type SnapFraction } from '../../utils/penShape';

interface PenControlsProps {
  readonly snap: SnapFraction;
  readonly onSnapChange: (snap: SnapFraction) => void;
  /** The one selected corner, or null when the selection is empty or multiple. */
  readonly lone: { readonly index: number; readonly x: number; readonly y: number } | null;
  /** Coordinate ceilings: the product grid maximum, so a point can be typed
   * past the current grid extent and grow the drawer on Apply. */
  readonly maxWmm: number;
  readonly maxDmm: number;
  readonly onCoordChange: (axis: 'x' | 'y', value: number) => void;
  readonly selectedCount: number;
  /** Shared radius of the corners the stepper edits, or null when they differ. */
  readonly filletValue: number | null;
  readonly maxFillet: number;
  readonly onFilletChange: (radius: number) => void;
  readonly onFilletStep: (delta: number) => void;
  readonly canDelete: boolean;
  readonly onDelete: () => void;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly viewMoved: boolean;
  readonly onResetView: () => void;
  readonly onImport: () => void;
  readonly onReset: () => void;
}

export function PenControls({
  snap,
  onSnapChange,
  lone,
  maxWmm,
  maxDmm,
  onCoordChange,
  selectedCount,
  filletValue,
  maxFillet,
  onFilletChange,
  onFilletStep,
  canDelete,
  onDelete,
  canUndo,
  onUndo,
  viewMoved,
  onResetView,
  onImport,
  onReset,
}: PenControlsProps) {
  const t = useTranslation();
  // The rounding control follows the selection, so its label has to say which
  // corners it will act on or the stepper reads as a global setting.
  const filletLabel =
    selectedCount > 0
      ? t('drawerShape.penFilletSelected', { count: selectedCount })
      : t('drawerShape.penFillet');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-secondary">{t('drawerShape.penSnap')}</span>
        <SegmentedControl
          aria-label={t('drawerShape.penSnap')}
          size="sm"
          options={SNAP_FRACTIONS.map((f) => ({
            value: String(f),
            label: f === 0 ? t('drawerShape.penSnapOff') : `${f}u`,
          }))}
          value={String(snap)}
          onChange={(v) => onSnapChange(Number(v) as SnapFraction)}
        />
      </div>
      {lone !== null && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-content-secondary">
            {t('drawerShape.penCorner', { n: lone.index + 1 })}
          </span>
          <NumberField
            label="X"
            value={lone.x}
            onChange={(v) => onCoordChange('x', v)}
            min={0}
            max={maxWmm}
            step={1}
            unit="mm"
          />
          <NumberField
            label="Y"
            value={lone.y}
            onChange={(v) => onCoordChange('y', v)}
            min={0}
            max={maxDmm}
            step={1}
            unit="mm"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-secondary">{filletLabel}</span>
        <Stepper
          value={filletValue ?? 0}
          onChange={onFilletChange}
          onStep={onFilletStep}
          min={0}
          max={maxFillet}
          step={1}
          // Outline coords are quantized to 0.01mm; without this the field's
          // default 1dp formatter re-rounds a typed radius (e.g. 2.55 → 2.6),
          // so decimals silently vanish on the display.
          inputDecimals={2}
          size="sm"
          aria-label={filletLabel}
        />
        {filletValue === null && (
          <span className="text-xs text-content-tertiary">{t('drawerShape.penFilletMixed')}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onDelete}
          disabled={!canDelete}
        >
          {t('drawerShape.penDeletePoint')}
        </Button>
        {viewMoved && (
          <Button type="button" variant="secondary" size="sm" onClick={onResetView}>
            {t('drawerShape.penResetView')}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo}>
          {t('common.undo')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onImport}>
          {t('drawerShape.penImport')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReset}>
          {t('drawerShape.penReset')}
        </Button>
      </div>
    </div>
  );
}
