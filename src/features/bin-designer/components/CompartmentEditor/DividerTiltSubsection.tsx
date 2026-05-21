/**
 * Inline tilt controls below the 2D compartment grid. One source of truth
 * for divider tilts (#1822): drag handles and the separate panel card were
 * three overlapping affordances; this is the only one.
 */

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
              onChange={(checked) => {
                if (checked) {
                  handlers.setAsymmetricMode(row.key, true);
                } else {
                  // Snap data back to mirrored using the mean magnitude;
                  // setSymmetricTilt also clears the forced-asymmetric flag.
                  handlers.setSymmetricTilt(row, (row.offsetStart - row.offsetEnd) / 2);
                }
              }}
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

function SymmetricControl({ row, handlers, t }: ControlProps) {
  const label = t('binDesigner.angledDividers.tilt');
  return (
    <div>
      <span className="mb-1 block text-[11px] text-content-tertiary">{label}</span>
      <StepperControl
        value={row.symmetricTilt}
        onChange={(v) => handlers.setSymmetricTilt(row, v)}
        onStep={(delta) => handlers.setSymmetricTilt(row, row.symmetricTilt + delta * TILT_UI_STEP)}
        min={-TILT_UI_MAX}
        max={TILT_UI_MAX}
        step={TILT_UI_STEP}
        variant="desktop"
        ariaLabel={label}
      />
    </div>
  );
}

function AsymmetricControls({ row, handlers, t }: ControlProps) {
  const startLabel = t('binDesigner.angledDividers.offsetStart');
  const endLabel = t('binDesigner.angledDividers.offsetEnd');
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] text-content-tertiary">{startLabel}</span>
        <StepperControl
          value={row.offsetStart}
          onChange={(v) => handlers.setAsymmetricOffset(row, 'start', v)}
          onStep={(delta) =>
            handlers.setAsymmetricOffset(row, 'start', row.offsetStart + delta * TILT_UI_STEP)
          }
          min={-TILT_UI_MAX}
          max={TILT_UI_MAX}
          step={TILT_UI_STEP}
          variant="desktop"
          ariaLabel={startLabel}
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] text-content-tertiary">{endLabel}</span>
        <StepperControl
          value={row.offsetEnd}
          onChange={(v) => handlers.setAsymmetricOffset(row, 'end', v)}
          onStep={(delta) =>
            handlers.setAsymmetricOffset(row, 'end', row.offsetEnd + delta * TILT_UI_STEP)
          }
          min={-TILT_UI_MAX}
          max={TILT_UI_MAX}
          step={TILT_UI_STEP}
          variant="desktop"
          ariaLabel={endLabel}
        />
      </div>
    </div>
  );
}

interface MiniDiagramProps {
  readonly compartments: CompartmentConfig;
  readonly row: TiltRow;
}

/**
 * 16×12 SVG showing the bin outline with this row's divider highlighted —
 * restores the spatial "which divider is this?" cue that the deleted
 * canvas drag handles previously provided.
 */
function DividerMiniDiagram({ compartments, row }: MiniDiagramProps) {
  const { cols, rows: gridRows } = compartments;
  const W = 16;
  const H = 12;
  const aBounds = getCompartmentBounds(compartments, row.compartmentA);
  const bBounds = getCompartmentBounds(compartments, row.compartmentB);
  if (!aBounds || !bBounds) return <svg width={W} height={H} aria-hidden="true" />;
  // The shared boundary sits at the further edge of whichever compartment
  // is "below" the divider on its perpendicular axis. For a vertical
  // divider (axis runs in Y) that's the right edge of the left-side comp;
  // for horizontal, the top edge of the bottom-side comp.
  const isVertical = row.axis === 'vertical';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect
        x={0.5}
        y={0.5}
        width={W - 1}
        height={H - 1}
        fill="none"
        className="stroke-stroke-subtle"
      />
      {isVertical ? (
        <line
          x1={(Math.min(aBounds.maxCol, bBounds.maxCol) + 1) * (W / cols)}
          y1={0}
          x2={(Math.min(aBounds.maxCol, bBounds.maxCol) + 1) * (W / cols)}
          y2={H}
          strokeWidth={1.5}
          className="stroke-accent"
        />
      ) : (
        // SVG y-axis is top-down; grid origin is bottom-left, so flip.
        <line
          x1={0}
          y1={H - (Math.min(aBounds.maxRow, bBounds.maxRow) + 1) * (H / gridRows)}
          x2={W}
          y2={H - (Math.min(aBounds.maxRow, bBounds.maxRow) + 1) * (H / gridRows)}
          strokeWidth={1.5}
          className="stroke-accent"
        />
      )}
    </svg>
  );
}
