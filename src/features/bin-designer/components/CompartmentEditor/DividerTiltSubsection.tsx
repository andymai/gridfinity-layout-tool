import { useRef, useState } from 'react';
import { ArrowLeftIcon, InfoIcon, RotateCcwIcon, XIcon } from '@/design-system/Icon';
import { Popover } from '@/design-system/Popover';
import { StepperControl } from '@/shared/components/StepperControl';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  TILT_UI_MAX,
  TILT_UI_STEP,
  getEndpointLabelKeys,
  useDividerTiltSubsection,
  type TiltRow,
} from './useDividerTiltSubsection';

export function DividerTiltSubsection() {
  const { compartments, rows, modifiedRows, hasAnyOverride, selectedRow, hoveredKey, handlers, t } =
    useDividerTiltSubsection();

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-stroke-subtle/40 pt-3">
      {selectedRow ? (
        <InspectorView row={selectedRow} compartments={compartments} handlers={handlers} t={t} />
      ) : (
        <ListView
          modifiedRows={modifiedRows}
          compartments={compartments}
          hasAnyOverride={hasAnyOverride}
          hoveredKey={hoveredKey}
          handlers={handlers}
          t={t}
        />
      )}
    </div>
  );
}

type Handlers = ReturnType<typeof useDividerTiltSubsection>['handlers'];
type Translate = ReturnType<typeof useDividerTiltSubsection>['t'];

interface ListViewProps {
  readonly modifiedRows: readonly TiltRow[];
  readonly compartments: CompartmentConfig;
  readonly hasAnyOverride: boolean;
  readonly hoveredKey: string | null;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function ListView({
  modifiedRows,
  compartments,
  hasAnyOverride,
  hoveredKey,
  handlers,
  t,
}: ListViewProps) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
            {t('binDesigner.angledDividers.title')}
          </h3>
          <InfoPopoverButton t={t} />
        </div>
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
      {modifiedRows.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="flex flex-col gap-1">
          {modifiedRows.map((row) => (
            <ModifiedDividerRow
              key={row.key}
              row={row}
              compartments={compartments}
              isHovered={hoveredKey === row.key}
              handlers={handlers}
              t={t}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({ t }: { readonly t: Translate }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
      <EmptyStateDiagram />
      <p className="text-xs text-content-secondary">
        {t('binDesigner.angledDividers.emptyHeading')}
      </p>
      <p className="text-[11px] text-content-tertiary">
        {t('binDesigner.angledDividers.emptyCta')}
      </p>
    </div>
  );
}

const EMPTY_DIAGRAM_W = 56;
const EMPTY_DIAGRAM_H = 36;

function EmptyStateDiagram() {
  return (
    <svg
      width={EMPTY_DIAGRAM_W}
      height={EMPTY_DIAGRAM_H}
      viewBox={`0 0 ${EMPTY_DIAGRAM_W} ${EMPTY_DIAGRAM_H}`}
      aria-hidden="true"
      className="text-content-tertiary"
    >
      <rect
        x={1}
        y={1}
        width={EMPTY_DIAGRAM_W - 2}
        height={EMPTY_DIAGRAM_H - 2}
        rx={3}
        fill="none"
        className="stroke-stroke-subtle"
        strokeWidth={1}
      />
      <line
        x1={EMPTY_DIAGRAM_W * 0.65}
        y1={2}
        x2={EMPTY_DIAGRAM_W * 0.35}
        y2={EMPTY_DIAGRAM_H - 2}
        strokeWidth={1.75}
        className="stroke-accent"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoPopoverButton({ t }: { readonly t: Translate }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('binDesigner.angledDividers.helpButtonLabel')}
        aria-expanded={open}
        className="flex h-4 w-4 items-center justify-center rounded-full text-content-tertiary transition-colors hover:text-content-secondary"
      >
        <InfoIcon size="xs" />
      </button>
      <Popover
        anchorRef={buttonRef}
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="max-w-[260px] p-3 text-xs text-content-secondary"
      >
        <p>{t('binDesigner.angledDividers.infoBody')}</p>
      </Popover>
    </>
  );
}

interface ModifiedDividerRowProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly isHovered: boolean;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function ModifiedDividerRow({
  row,
  compartments,
  isHovered,
  handlers,
  t,
}: ModifiedDividerRowProps) {
  const rowLabel = t('binDesigner.angledDividers.rowLabel', {
    a: String(row.compartmentA + 1),
    b: String(row.compartmentB + 1),
  });
  const stateLabel = t('binDesigner.angledDividers.stateTilted', {
    start: String(Math.round(row.offsetStart * 10) / 10),
    end: String(Math.round(row.offsetEnd * 10) / 10),
  });

  return (
    <div
      onPointerEnter={() => handlers.hoverDivider(row.key)}
      onPointerLeave={() => handlers.hoverDivider(null)}
      // Focus-capture mirrors pointerEnter so keyboard users get the same
      // canvas + compartment highlight as mouse users when they tab onto the
      // row. Capture phase + check that focus is leaving the wrapper entirely
      // (relatedTarget outside) so tabbing between the edit and ✕ buttons
      // inside the row doesn't flicker the highlight off.
      onFocusCapture={() => handlers.hoverDivider(row.key)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          handlers.hoverDivider(null);
        }
      }}
      className={`flex items-center rounded-md border bg-surface-elevated transition-colors ${
        isHovered
          ? 'border-accent/60 bg-accent/5'
          : 'border-stroke-subtle hover:border-stroke-subtle/80'
      }`}
    >
      <button
        type="button"
        onClick={() => handlers.selectDivider(row.key)}
        aria-label={t('binDesigner.angledDividers.editRowLabel', {
          a: String(row.compartmentA + 1),
          b: String(row.compartmentB + 1),
        })}
        className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
      >
        <DividerMiniDiagram compartments={compartments} row={row} />
        <span className="text-xs font-medium text-content-secondary tabular-nums">{rowLabel}</span>
        <span className="ml-auto text-[11px] tabular-nums text-content-tertiary">{stateLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => handlers.resetRow(row)}
        aria-label={t('binDesigner.angledDividers.resetRow')}
        className="px-1.5 py-1.5 text-content-tertiary transition-colors hover:text-content-secondary"
      >
        <XIcon size="xs" />
      </button>
    </div>
  );
}

interface InspectorViewProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function InspectorView({ row, compartments, handlers, t }: InspectorViewProps) {
  const labelKeys = getEndpointLabelKeys(row.axis);
  const startLabel = t(`binDesigner.angledDividers.${labelKeys.start}`);
  const endLabel = t(`binDesigner.angledDividers.${labelKeys.end}`);
  const axisLabel = t(
    row.axis === 'vertical'
      ? 'binDesigner.angledDividers.axisVertical'
      : 'binDesigner.angledDividers.axisHorizontal'
  );
  const rowLabel = t('binDesigner.angledDividers.rowLabel', {
    a: String(row.compartmentA + 1),
    b: String(row.compartmentB + 1),
  });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handlers.selectDivider(null)}
          className="flex items-center gap-1 text-[11px] font-medium text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeftIcon size="xs" />
          {t('binDesigner.angledDividers.backToList')}
        </button>
        {row.hasTilt && (
          <button
            type="button"
            onClick={() => handlers.resetRow(row)}
            className="flex items-center gap-1 text-[11px] font-medium text-content-tertiary transition-colors hover:text-content-secondary"
          >
            <RotateCcwIcon size="xs" />
            {t('binDesigner.angledDividers.resetToStraight')}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DividerMiniDiagram compartments={compartments} row={row} />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-content-primary tabular-nums">{rowLabel}</span>
          <span className="text-[11px] text-content-tertiary">{axisLabel}</span>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <TiltStepper
          label={startLabel}
          value={row.offsetStart}
          onSet={(v) => handlers.setOffset(row, 'start', v)}
        />
        <TiltStepper
          label={endLabel}
          value={row.offsetEnd}
          onSet={(v) => handlers.setOffset(row, 'end', v)}
        />
      </div>
    </div>
  );
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
