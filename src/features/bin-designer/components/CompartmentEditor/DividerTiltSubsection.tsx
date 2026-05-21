import { ChevronDownIcon, RotateCcwIcon } from '@/design-system/Icon';
import { Checkbox } from '@/design-system/Checkbox';
import { StepperControl } from '@/shared/components/StepperControl';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  TILT_UI_MAX,
  TILT_UI_STEP,
  useDividerTiltSubsection,
  type TiltRow,
} from './useDividerTiltSubsection';

export function DividerTiltSubsection() {
  const { compartments, rows, hasAnyOverride, expandedKey, handlers, t } =
    useDividerTiltSubsection();

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-stroke-subtle/40 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
          {t('binDesigner.angledDividers.title')}
        </h3>
        {hasAnyOverride && (
          <button
            type="button"
            onClick={handlers.resetAll}
            className="text-[11px] font-medium text-accent transition-colors hover:text-accent/80"
          >
            {t('binDesigner.angledDividers.resetAll')}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <DividerRow
            key={row.key}
            row={row}
            compartments={compartments}
            isExpanded={expandedKey === row.key}
            handlers={handlers}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

interface DividerRowProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly isExpanded: boolean;
  readonly handlers: ReturnType<typeof useDividerTiltSubsection>['handlers'];
  readonly t: ReturnType<typeof useDividerTiltSubsection>['t'];
}

function DividerRow({ row, compartments, isExpanded, handlers, t }: DividerRowProps) {
  const hasTilt = row.offsetStart !== 0 || row.offsetEnd !== 0;
  const rowLabel = t('binDesigner.angledDividers.rowLabel', {
    a: String(row.compartmentA + 1),
    b: String(row.compartmentB + 1),
  });
  const state = hasTilt
    ? t('binDesigner.angledDividers.stateTilted', {
        start: String(Math.round(row.offsetStart * 10) / 10),
        end: String(Math.round(row.offsetEnd * 10) / 10),
      })
    : t('binDesigner.angledDividers.stateStraight');

  return (
    <div className="rounded-md border border-stroke-subtle bg-surface-elevated">
      <button
        type="button"
        onClick={() => handlers.toggleExpanded(row.key)}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-hover"
      >
        <DividerMiniDiagram compartments={compartments} row={row} />
        <span className="text-xs font-medium text-content-secondary tabular-nums">{rowLabel}</span>
        <span className="ml-auto text-[11px] tabular-nums text-content-tertiary">{state}</span>
        <ChevronDownIcon
          size="xs"
          className={`text-content-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && (
        <div className="flex flex-col gap-2 border-t border-stroke-subtle/40 px-2 pb-2 pt-2">
          {row.showAsymmetric ? (
            <AsymmetricControls row={row} handlers={handlers} t={t} />
          ) : (
            <SymmetricControl row={row} handlers={handlers} t={t} />
          )}
          <div className="flex items-center justify-between">
            <Checkbox
              checked={row.showAsymmetric}
              onChange={(checked) =>
                checked
                  ? handlers.setAsymmetricMode(row.key, true)
                  : handlers.setSymmetricTilt(row, (row.offsetStart - row.offsetEnd) / 2)
              }
              label={t('binDesigner.angledDividers.asymmetric')}
            />
            {hasTilt && (
              <button
                type="button"
                onClick={() => handlers.resetRow(row)}
                aria-label={t('binDesigner.angledDividers.resetRow')}
                className="text-content-tertiary transition-colors hover:text-content-secondary"
              >
                <RotateCcwIcon size="xs" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ControlProps {
  readonly row: TiltRow;
  readonly handlers: ReturnType<typeof useDividerTiltSubsection>['handlers'];
  readonly t: ReturnType<typeof useDividerTiltSubsection>['t'];
}

interface TiltStepperProps {
  readonly label: string;
  readonly value: number;
  readonly onSet: (next: number) => void;
}

function TiltStepper({ label, value, onSet }: TiltStepperProps) {
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1 block text-[11px] text-content-tertiary">{label}</span>
      <StepperControl
        value={value}
        onChange={onSet}
        onStep={(delta) => onSet(value + delta * TILT_UI_STEP)}
        min={-TILT_UI_MAX}
        max={TILT_UI_MAX}
        step={TILT_UI_STEP}
        variant="desktop"
        ariaLabel={label}
      />
    </div>
  );
}

function SymmetricControl({ row, handlers, t }: ControlProps) {
  return (
    <TiltStepper
      label={t('binDesigner.angledDividers.tilt')}
      value={row.symmetricTilt}
      onSet={(v) => handlers.setSymmetricTilt(row, v)}
    />
  );
}

function AsymmetricControls({ row, handlers, t }: ControlProps) {
  return (
    <div className="flex items-end gap-2">
      <TiltStepper
        label={t('binDesigner.angledDividers.offsetStart')}
        value={row.offsetStart}
        onSet={(v) => handlers.setAsymmetricOffset(row, 'start', v)}
      />
      <TiltStepper
        label={t('binDesigner.angledDividers.offsetEnd')}
        value={row.offsetEnd}
        onSet={(v) => handlers.setAsymmetricOffset(row, 'end', v)}
      />
    </div>
  );
}

interface MiniDiagramProps {
  readonly compartments: CompartmentConfig;
  readonly row: TiltRow;
}

const DIAGRAM_W = 16;
const DIAGRAM_H = 12;

function DividerMiniDiagram({ compartments, row }: MiniDiagramProps) {
  const { cols, rows: gridRows } = compartments;
  const aBounds = getCompartmentBounds(compartments, row.compartmentA);
  const bBounds = getCompartmentBounds(compartments, row.compartmentB);
  if (!aBounds || !bBounds) {
    return <svg width={DIAGRAM_W} height={DIAGRAM_H} aria-hidden="true" />;
  }

  const isVertical = row.axis === 'vertical';
  // Shared boundary = far edge of the lower-indexed compartment on the
  // perpendicular axis. SVG y is top-down so horizontal lines flip via H - y.
  const boundary = isVertical
    ? (Math.min(aBounds.maxCol, bBounds.maxCol) + 1) * (DIAGRAM_W / cols)
    : DIAGRAM_H - (Math.min(aBounds.maxRow, bBounds.maxRow) + 1) * (DIAGRAM_H / gridRows);

  return (
    <svg
      width={DIAGRAM_W}
      height={DIAGRAM_H}
      viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
      aria-hidden="true"
    >
      <rect
        x={0.5}
        y={0.5}
        width={DIAGRAM_W - 1}
        height={DIAGRAM_H - 1}
        fill="none"
        className="stroke-stroke-subtle"
      />
      <line
        x1={isVertical ? boundary : 0}
        y1={isVertical ? 0 : boundary}
        x2={isVertical ? boundary : DIAGRAM_W}
        y2={isVertical ? DIAGRAM_H : boundary}
        strokeWidth={1.5}
        className="stroke-accent"
      />
    </svg>
  );
}
