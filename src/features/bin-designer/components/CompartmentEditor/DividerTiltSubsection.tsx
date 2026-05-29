import { useRef, useState } from 'react';
import { ArrowLeftIcon, InfoIcon, RotateCcwIcon } from '@/design-system/Icon';
import { Popover } from '@/design-system/Popover';
import { Slider } from '@/design-system/Slider';
import { Collapsible } from '@/design-system/Collapsible';
import { StepperControl } from '@/shared/components/StepperControl';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  ANGLE_PRESETS_DEG,
  ANGLE_UI_MAX_DEG,
  ANGLE_UI_STEP_DEG,
  SHIFT_UI_STEP_MM,
} from '@/features/bin-designer/utils/dividerAngle';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { useDividerTiltSubsection, type TiltRow } from './useDividerTiltSubsection';

export function DividerTiltSubsection() {
  const {
    compartments,
    rows,
    hasAnyOverride,
    activeConflicts,
    selectedRow,
    selectedAngleShift,
    hoveredKey,
    handlers,
    t,
  } = useDividerTiltSubsection();

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-stroke-subtle/40 pt-3">
      {selectedRow ? (
        <InspectorView
          row={selectedRow}
          compartments={compartments}
          angleDeg={selectedAngleShift.angleDeg}
          shiftMm={selectedAngleShift.shiftMm}
          conflicts={activeConflicts}
          handlers={handlers}
          t={t}
        />
      ) : (
        <ListView
          rows={rows}
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

type Hook = ReturnType<typeof useDividerTiltSubsection>;
type Handlers = Hook['handlers'];
type Translate = Hook['t'];
type Conflict = Hook['activeConflicts'][number];

interface ListViewProps {
  readonly rows: readonly TiltRow[];
  readonly compartments: CompartmentConfig;
  readonly hasAnyOverride: boolean;
  readonly hoveredKey: string | null;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function ListView({ rows, compartments, hasAnyOverride, hoveredKey, handlers, t }: ListViewProps) {
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
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {rows.map((row) => (
          <DividerRow
            key={row.key}
            row={row}
            compartments={compartments}
            isHovered={hoveredKey === row.key}
            handlers={handlers}
            t={t}
          />
        ))}
      </div>
    </>
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

interface DividerRowProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly isHovered: boolean;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function DividerRow({ row, compartments, isHovered, handlers, t }: DividerRowProps) {
  const rowLabel = t('binDesigner.angledDividers.rowLabel', {
    a: String(row.compartmentA + 1),
    b: String(row.compartmentB + 1),
  });

  return (
    <div
      onPointerEnter={() => handlers.hoverDivider(row.key)}
      onPointerLeave={() => handlers.hoverDivider(null)}
      onFocusCapture={() => handlers.hoverDivider(row.key)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) handlers.hoverDivider(null);
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
        {row.hasTilt && (
          <span className="ml-auto text-[11px] font-medium tabular-nums text-accent">
            {t('binDesigner.angledDividers.badgeAngle', {
              angle: String(Math.round(row.angleDeg)),
            })}
          </span>
        )}
      </button>
    </div>
  );
}

interface InspectorViewProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly angleDeg: number;
  readonly shiftMm: number;
  readonly conflicts: readonly Conflict[];
  readonly handlers: Handlers;
  readonly t: Translate;
}

function InspectorView({
  row,
  compartments,
  angleDeg,
  shiftMm,
  conflicts,
  handlers,
  t,
}: InspectorViewProps) {
  const axisLabel = t(
    row.axis === 'vertical'
      ? 'binDesigner.angledDividers.axisVertical'
      : 'binDesigner.angledDividers.axisHorizontal'
  );
  const rowLabel = t('binDesigner.angledDividers.rowLabel', {
    a: String(row.compartmentA + 1),
    b: String(row.compartmentB + 1),
  });
  const angleLabel = t('binDesigner.angledDividers.angleLabel');
  const disabled = row.geometry === null;
  const shiftRange = row.geometry ?? { offsetMin: 0, offsetMax: 0 };

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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-content-tertiary">{angleLabel}</span>
          <StepperControl
            value={angleDeg}
            onChange={(v) => handlers.commitTilt(row, { angleDeg: v, shiftMm })}
            onStep={(delta) => handlers.commitTilt(row, { angleDeg: angleDeg + delta, shiftMm })}
            min={-ANGLE_UI_MAX_DEG}
            max={ANGLE_UI_MAX_DEG}
            step={1}
            variant="desktop"
            ariaLabel={angleLabel}
            disabled={disabled}
          />
        </div>
        <Slider
          value={angleDeg}
          onChange={(v) => handlers.previewTilt(row, { angleDeg: v, shiftMm })}
          onCommit={(v) => handlers.commitTilt(row, { angleDeg: v, shiftMm })}
          min={-ANGLE_UI_MAX_DEG}
          max={ANGLE_UI_MAX_DEG}
          step={ANGLE_UI_STEP_DEG}
          disabled={disabled}
          aria-label={angleLabel}
          aria-valuetext={t('binDesigner.angledDividers.badgeAngle', {
            angle: String(Math.round(angleDeg)),
          })}
        />
        <div className="flex flex-wrap gap-1">
          {ANGLE_PRESETS_DEG.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => handlers.commitTilt(row, { angleDeg: preset, shiftMm })}
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors disabled:opacity-40 ${
                Math.round(angleDeg) === preset
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-stroke-subtle text-content-tertiary hover:border-stroke hover:text-content-secondary'
              }`}
            >
              {t('binDesigner.angledDividers.badgeAngle', { angle: String(preset) })}
            </button>
          ))}
        </div>
      </div>

      <Collapsible
        title={t('binDesigner.angledDividers.fineTune')}
        size="sm"
        defaultExpanded={false}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-content-tertiary">
            {t('binDesigner.angledDividers.shiftLabel')}
          </span>
          <StepperControl
            value={shiftMm}
            onChange={(v) => handlers.commitTilt(row, { angleDeg, shiftMm: v })}
            onStep={(delta) =>
              handlers.commitTilt(row, { angleDeg, shiftMm: shiftMm + delta * SHIFT_UI_STEP_MM })
            }
            min={shiftRange.offsetMin}
            max={shiftRange.offsetMax}
            step={SHIFT_UI_STEP_MM}
            variant="desktop"
            ariaLabel={t('binDesigner.angledDividers.shiftLabel')}
            disabled={disabled}
          />
        </div>
      </Collapsible>

      {row.hasTilt && conflicts.length > 0 && (
        <p className="rounded bg-warning-muted px-2 py-1.5 text-[11px] text-content-secondary">
          {t('binDesigner.angledDividers.conflictNotice')}
        </p>
      )}
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

  // A small visual lean so tilted rows read as diagonal at a glance.
  const lean = row.hasTilt ? Math.sign(row.angleDeg) * Math.min(4, Math.abs(row.angleDeg) / 12) : 0;

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
        x1={isVertical ? boundary - lean : 0}
        y1={isVertical ? 0 : boundary - lean}
        x2={isVertical ? boundary + lean : DIAGRAM_W}
        y2={isVertical ? DIAGRAM_H : boundary + lean}
        strokeWidth={1.5}
        className="stroke-accent"
      />
    </svg>
  );
}
