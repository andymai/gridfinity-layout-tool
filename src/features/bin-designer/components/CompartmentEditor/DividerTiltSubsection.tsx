import { useRef, useState } from 'react';
import { ArrowLeftIcon, InfoIcon, RotateCcwIcon } from '@/design-system/Icon';
import { Popover } from '@/design-system/Popover';
import { Slider } from '@/design-system/Slider';
import { Switch } from '@/design-system/Switch';
import { Collapsible } from '@/design-system/Collapsible';
import { Button, IconButton, Stepper } from '@/design-system';
import { useSettingsStore } from '@/core/store/settings';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  ANGLE_PRESETS_DEG,
  ANGLE_UI_MAX_DEG,
  ANGLE_UI_STEP_DEG,
  LEAN_PRESETS_DEG,
  LEAN_UI_MAX_DEG,
  LEAN_UI_STEP_DEG,
  SHIFT_UI_STEP_MM,
  applyAngleShift,
} from '@/features/bin-designer/utils/dividerAngle';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  DividerMiniDiagram,
  DividerPlanDiagram,
  LeanSpecimen,
  TeaserDiagram,
} from './DividerDiagrams';
import { useDividerTiltSubsection, type TiltRow } from './useDividerTiltSubsection';

export function DividerTiltSubsection() {
  const {
    compartments,
    interiorDims,
    rows,
    hasAnyOverride,
    activeConflicts,
    selectedRow,
    selectedAngleShift,
    leanLimits,
    leanReadout,
    hoveredKey,
    handlers,
    t,
  } = useDividerTiltSubsection();

  const enabled = useSettingsStore((s) => s.settings.angledDividersEnabled);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  if (rows.length === 0) return null;

  // Advanced opt-in: divider editing is off by default so dense grids don't
  // drown the panel in per-divider rows. Toggling off also drops any in-flight
  // selection/hover so the canvas overlay clears cleanly.
  const toggleEnabled = (): void => {
    const next = !enabled;
    updateSetting('angledDividersEnabled', next);
    trackEvent('divider_editing_toggled', { enabled: next, source: 'switch' });
    if (!next) {
      handlers.selectDivider(null);
      handlers.hoverDivider(null);
    }
  };

  return (
    <div className="mt-3 border-t border-stroke-subtle/40 pt-3">
      <div className={`flex items-center justify-between ${enabled ? 'mb-2' : ''}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
            {t('binDesigner.angledDividers.title')}
          </span>
          <InfoPopoverButton t={t} />
        </div>
        <Switch
          checked={enabled}
          onChange={toggleEnabled}
          size="sm"
          aria-label={t('binDesigner.angledDividers.toggleLabel')}
        />
      </div>

      {!enabled && <Teaser t={t} />}

      {enabled &&
        (selectedRow ? (
          <InspectorView
            row={selectedRow}
            compartments={compartments}
            interiorW={interiorDims.innerW}
            interiorD={interiorDims.innerD}
            angleDeg={selectedAngleShift.angleDeg}
            leanDeg={selectedAngleShift.leanDeg}
            leanLimits={leanLimits}
            leanReadout={leanReadout}
            shiftMm={selectedAngleShift.shiftMm}
            conflicts={activeConflicts}
            handlers={handlers}
            t={t}
          />
        ) : (
          <ListView
            rows={rows}
            compartments={compartments}
            hoveredKey={hoveredKey}
            hasAnyOverride={hasAnyOverride}
            handlers={handlers}
            t={t}
          />
        ))}
    </div>
  );
}

type Hook = ReturnType<typeof useDividerTiltSubsection>;
type Handlers = Hook['handlers'];
type Translate = Hook['t'];
type Conflict = Hook['activeConflicts'][number];

/**
 * Off-state teaser: the section header alone doesn't say what the feature does,
 * so the closed state carries a one-glance pitch — a wall drawn mid-tilt and
 * one sentence naming the payoff and both entry points (grid click or switch).
 */
function Teaser({ t }: { readonly t: Translate }) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <TeaserDiagram />
      <p className="flex-1 text-label leading-relaxed text-content-tertiary">
        {t('binDesigner.angledDividers.teaser')}
      </p>
    </div>
  );
}

interface ListViewProps {
  readonly rows: readonly TiltRow[];
  readonly compartments: CompartmentConfig;
  readonly hoveredKey: string | null;
  readonly hasAnyOverride: boolean;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function ListView({ rows, compartments, hoveredKey, hasAnyOverride, handlers, t }: ListViewProps) {
  // Present in display-number order so the list scans like the numbers on the
  // grid. Display-only: the hook's row order (stable ID pairs) is what the
  // Bento dock and the hit targets key off, and stays untouched.
  const sorted = [...rows].sort(
    (a, b) =>
      Math.min(a.numberA, a.numberB) - Math.min(b.numberA, b.numberB) ||
      Math.max(a.numberA, a.numberB) - Math.max(b.numberA, b.numberB)
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {sorted.map((row) => (
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
      {hasAnyOverride && (
        <Button
          type="button"
          variant="ghost"
          onClick={handlers.resetAll}
          className="self-end px-0 py-0 text-label font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
        >
          {t('binDesigner.angledDividers.resetAll')}
        </Button>
      )}
    </div>
  );
}

function InfoPopoverButton({ t }: { readonly t: Translate }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        touchTarget={false}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('binDesigner.angledDividers.helpButtonLabel')}
        aria-expanded={open}
        className="h-4 w-4 rounded-full text-content-tertiary hover:bg-transparent hover:text-content-secondary"
      >
        <InfoIcon size="xs" />
      </IconButton>
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
  // Ascending display numbers: the ID-canonical pair order can put the higher
  // number first (bottom-row IDs display as high numbers), which reads as noise.
  const lo = String(Math.min(row.numberA, row.numberB));
  const hi = String(Math.max(row.numberA, row.numberB));
  const rowLabel = t('binDesigner.angledDividers.rowLabel', { a: lo, b: hi });
  const hasPlanTilt = row.offsetStart !== 0 || row.offsetEnd !== 0;
  const leanRounded = Math.round(row.leanDeg);

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
      <Button
        type="button"
        variant="ghost"
        onClick={() => handlers.selectDivider(row.key)}
        aria-label={t('binDesigner.angledDividers.editRowLabel', { a: lo, b: hi })}
        className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
      >
        <DividerMiniDiagram compartments={compartments} row={row} />
        <span className="text-xs font-medium text-content-secondary tabular-nums">{rowLabel}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {row.hasTilt && hasPlanTilt && (
            <span className="text-label font-medium tabular-nums text-accent">
              {t('binDesigner.angledDividers.badgeAngle', {
                angle: String(Math.round(row.angleDeg)),
              })}
            </span>
          )}
          {leanRounded !== 0 && (
            <span className="text-label font-medium tabular-nums text-content-secondary">
              {t('binDesigner.angledDividers.rowBadgeLean', { angle: String(leanRounded) })}
            </span>
          )}
        </span>
      </Button>
    </div>
  );
}

interface InspectorViewProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly interiorW: number;
  readonly interiorD: number;
  readonly angleDeg: number;
  readonly leanDeg: number;
  readonly shiftMm: number;
  readonly leanLimits: LeanLimits;
  readonly leanReadout: LeanReadout;
  readonly conflicts: readonly Conflict[];
  readonly handlers: Handlers;
  readonly t: Translate;
}

function InspectorView({
  row,
  compartments,
  interiorW,
  interiorD,
  angleDeg,
  leanDeg,
  shiftMm,
  leanLimits,
  leanReadout,
  conflicts,
  handlers,
  t,
}: InspectorViewProps) {
  const angleLabel = t('binDesigner.angledDividers.angleLabel');
  const leanLabel = t('binDesigner.angledDividers.leanLabel');
  const disabled = row.geometry === null;
  const shiftRange = row.geometry ?? { offsetMin: 0, offsetMax: 0 };
  const leanBounds = leanLimits ?? { minDeg: -LEAN_UI_MAX_DEG, maxDeg: LEAN_UI_MAX_DEG };

  // Live endpoint offsets: the same clamp the commit path runs, so the diagram
  // draws exactly the wall the user would get, mid-drag included.
  const liveOffsets = row.geometry
    ? applyAngleShift({ angleDeg, shiftMm, leanDeg }, row.geometry)
    : { offsetStart: row.offsetStart, offsetEnd: row.offsetEnd, rakeDeg: row.rakeDeg };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => handlers.selectDivider(null)}
          className="flex items-center gap-1 px-0 py-0 text-label font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
        >
          <ArrowLeftIcon size="xs" />
          {t('binDesigner.angledDividers.backToList')}
        </Button>
        {row.hasTilt && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => handlers.resetRow(row)}
            className="flex items-center gap-1 px-0 py-0 text-label font-medium text-content-tertiary transition-colors hover:bg-transparent hover:text-content-secondary"
          >
            <RotateCcwIcon size="xs" />
            {t('binDesigner.angledDividers.resetToStraight')}
          </Button>
        )}
      </div>

      <p className="text-xs font-medium text-content-primary">
        {betweenLabel(row, compartments, t)}
      </p>

      <div className="flex items-center justify-evenly gap-3 rounded-md border border-stroke-subtle/60 bg-surface-elevated px-2 py-2">
        <figure className="flex flex-col items-center gap-1">
          <DividerPlanDiagram
            compartments={compartments}
            row={row}
            offsets={liveOffsets}
            interiorW={interiorW}
            interiorD={interiorD}
            dividerHeightMm={row.geometry?.dividerHeightMm ?? 0}
          />
          <figcaption className="text-micro text-content-tertiary">
            {t('binDesigner.angledDividers.topView')}
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-1">
          <LeanSpecimen leanDeg={leanDeg} />
          <figcaption className="text-micro text-content-tertiary">
            {t('binDesigner.angledDividers.sideView')}
          </figcaption>
        </figure>
      </div>

      <TiltControl
        label={angleLabel}
        value={angleDeg}
        min={-ANGLE_UI_MAX_DEG}
        max={ANGLE_UI_MAX_DEG}
        sliderStep={ANGLE_UI_STEP_DEG}
        presets={ANGLE_PRESETS_DEG}
        presetText={(v) => t('binDesigner.angledDividers.badgeAngle', { angle: String(v) })}
        presetAria={(v) => t('binDesigner.angledDividers.presetAngle', { angle: String(v) })}
        valueText={t('binDesigner.angledDividers.badgeAngle', {
          angle: String(Math.round(angleDeg)),
        })}
        disabled={disabled}
        onPreview={(v) => handlers.previewTilt(row, { angleDeg: v, shiftMm, leanDeg })}
        onCommit={(v) => handlers.commitTilt(row, { angleDeg: v, shiftMm, leanDeg })}
        onStep={(delta) =>
          handlers.commitTilt(row, { angleDeg: angleDeg + delta, shiftMm, leanDeg })
        }
      />

      <TiltControl
        label={leanLabel}
        value={leanDeg}
        min={leanBounds.minDeg}
        max={leanBounds.maxDeg}
        sliderStep={LEAN_UI_STEP_DEG}
        presets={LEAN_PRESETS_DEG}
        presetText={(v) => t('binDesigner.angledDividers.badgeLean', { angle: String(v) })}
        presetAria={(v) => t('binDesigner.angledDividers.presetLean', { angle: String(v) })}
        presetDisabled={(v) => v > leanBounds.maxDeg}
        valueText={t('binDesigner.angledDividers.badgeLean', {
          angle: String(Math.round(leanDeg)),
        })}
        disabled={disabled}
        onPreview={(v) => handlers.previewTilt(row, { angleDeg, shiftMm, leanDeg: v })}
        onCommit={(v) => handlers.commitTilt(row, { angleDeg, shiftMm, leanDeg: v })}
        onStep={(delta) =>
          handlers.commitTilt(row, { angleDeg, shiftMm, leanDeg: leanDeg + delta })
        }
      />

      {leanReadout && (
        <div className="flex flex-col gap-0.5 rounded border border-stroke-subtle/60 px-2 py-1.5">
          <ReadoutRow
            label={t('binDesigner.angledDividers.clearOpening')}
            value={t('binDesigner.angledDividers.mmValue', {
              mm: leanReadout.openingMm.toFixed(1),
            })}
          />
          <ReadoutRow
            label={t('binDesigner.angledDividers.footTravel')}
            value={t('binDesigner.angledDividers.mmValue', { mm: leanReadout.travelMm.toFixed(1) })}
          />
          <ReadoutRow
            label={t('binDesigner.angledDividers.maxLean')}
            value={t('binDesigner.angledDividers.badgeLean', {
              angle: String(leanBounds.maxDeg),
            })}
          />
        </div>
      )}

      {leanDeg !== 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => handlers.applyLeanToAxis(row)}
          className="self-start px-0 py-0 text-label font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
        >
          {t('binDesigner.angledDividers.applyLeanToAxis')}
        </Button>
      )}

      <Collapsible
        title={t('binDesigner.angledDividers.fineTune')}
        size="sm"
        defaultExpanded={false}
      >
        <div className="flex items-center justify-between">
          <span className="text-label text-content-tertiary">
            {t('binDesigner.angledDividers.shiftLabel')}
          </span>
          <Stepper
            value={shiftMm}
            onChange={(v) => handlers.commitTilt(row, { angleDeg, shiftMm: v, leanDeg })}
            onStep={(delta) =>
              handlers.commitTilt(row, {
                angleDeg,
                shiftMm: shiftMm + delta * SHIFT_UI_STEP_MM,
                leanDeg,
              })
            }
            min={shiftRange.offsetMin}
            max={shiftRange.offsetMax}
            step={SHIFT_UI_STEP_MM}
            size="md"
            aria-label={t('binDesigner.angledDividers.shiftLabel')}
            disabled={disabled}
          />
        </div>
      </Collapsible>

      {row.hasTilt && conflicts.length > 0 && (
        <p className="rounded bg-warning-muted px-2 py-1.5 text-label text-content-secondary">
          {t('binDesigner.angledDividers.conflictNotice')}
        </p>
      )}
    </div>
  );
}

/**
 * Positional identity line: says which compartment sits on which side of the
 * wall, so the label works without the user knowing compartment numbering.
 * Compartment order in the pair is by ID, not position — the bounds decide
 * which one is actually left/front.
 */
function betweenLabel(row: TiltRow, compartments: CompartmentConfig, t: Translate): string {
  const aBounds = getCompartmentBounds(compartments, row.compartmentA);
  const bBounds = getCompartmentBounds(compartments, row.compartmentB);
  if (!aBounds || !bBounds) {
    return t('binDesigner.angledDividers.rowLabel', {
      a: String(row.numberA),
      b: String(row.numberB),
    });
  }
  if (row.axis === 'vertical') {
    const aIsFirst = aBounds.maxCol < bBounds.maxCol;
    return t('binDesigner.angledDividers.betweenVertical', {
      a: String(aIsFirst ? row.numberA : row.numberB),
      b: String(aIsFirst ? row.numberB : row.numberA),
    });
  }
  const aIsFirst = aBounds.maxRow < bBounds.maxRow;
  return t('binDesigner.angledDividers.betweenHorizontal', {
    a: String(aIsFirst ? row.numberA : row.numberB),
    b: String(aIsFirst ? row.numberB : row.numberA),
  });
}

interface TiltControlProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly sliderStep: number;
  readonly presets: readonly number[];
  readonly presetText: (v: number) => string;
  readonly presetAria: (v: number) => string;
  readonly presetDisabled?: (v: number) => boolean;
  readonly valueText: string;
  readonly disabled: boolean;
  readonly onPreview: (v: number) => void;
  readonly onCommit: (v: number) => void;
  readonly onStep: (delta: number) => void;
}

/**
 * One angle control: label + preset chips + stepper on a single row, slider
 * under it. Angle and Lean are siblings and must look it, so both render
 * through this — any layout change lands on both at once.
 */
function TiltControl({
  label,
  value,
  min,
  max,
  sliderStep,
  presets,
  presetText,
  presetAria,
  presetDisabled,
  valueText,
  disabled,
  onPreview,
  onCommit,
  onStep,
}: TiltControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-content-tertiary">{label}</span>
        <span className="flex items-center gap-1">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="ghost"
              disabled={disabled || (presetDisabled?.(preset) ?? false)}
              onClick={() => onCommit(preset)}
              aria-label={presetAria(preset)}
              className={`rounded border px-1.5 py-0.5 text-micro font-medium tabular-nums transition-colors disabled:opacity-40 ${
                Math.round(value) === preset
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-stroke-subtle text-content-tertiary hover:border-stroke hover:text-content-secondary'
              }`}
            >
              {presetText(preset)}
            </Button>
          ))}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Slider
            value={value}
            onChange={onPreview}
            onCommit={onCommit}
            min={min}
            max={max}
            step={sliderStep}
            disabled={disabled}
            aria-label={label}
            aria-valuetext={valueText}
          />
        </div>
        <Stepper
          value={value}
          onChange={onCommit}
          onStep={onStep}
          min={min}
          max={max}
          step={1}
          size="md"
          aria-label={label}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

type LeanLimits = Hook['leanLimits'];
type LeanReadout = Hook['leanReadout'];

function ReadoutRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-label text-content-tertiary">{label}</span>
      <span className="text-label font-medium tabular-nums text-content-secondary">{value}</span>
    </div>
  );
}
