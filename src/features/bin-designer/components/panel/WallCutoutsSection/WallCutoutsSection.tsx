/**
 * Wall cutouts section: U-shaped notches from the top of bin walls.
 *
 * Controls: master toggle, toggle chip row (L/R/F/B), linked/independent mode,
 * shared or per-side span/height steppers, interior checkbox.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import type { WallSide, WallCutoutShape, LabelTabAlignment } from '@/features/bin-designer/types';

const SIDE_ORDER: readonly Exclude<WallSide, 'interior'>[] = ['left', 'right', 'front', 'back'];
const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const OFFSET_STEP = 1;

const SHAPE_OPTIONS: readonly { value: WallCutoutShape; labelKey: string }[] = [
  { value: 'u-shape', labelKey: 'binDesigner.wallCutouts.shape.uShape' },
  { value: 'scoop', labelKey: 'binDesigner.wallCutouts.shape.scoop' },
  { value: 'funnel', labelKey: 'binDesigner.wallCutouts.shape.funnel' },
];

/** Inline SVG chain-link icon (12×12). */
function LinkIcon({ linked }: { linked: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      {linked ? (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      ) : (
        <>
          <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-3 3a5 5 0 0 0 .12 7.19" />
          <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l3-3a5 5 0 0 0-.12-7.19" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      )}
    </svg>
  );
}

function SpanHeightSteppers({
  side,
  label,
  width,
  depth,
  step,
  onWidthChange,
  onDepthChange,
  spanLabel,
  heightLabel,
  hideDepth,
}: {
  side: WallSide;
  label: string;
  width: number;
  depth: number;
  step: number;
  onWidthChange: (side: WallSide, value: number) => void;
  onDepthChange: (side: WallSide, value: number) => void;
  spanLabel: string;
  heightLabel: string;
  hideDepth?: boolean;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 min-w-0">
        <span className="mb-1 block text-xs text-content-tertiary">{spanLabel}</span>
        <StepperControl
          value={width}
          onChange={(v) => onWidthChange(side, v)}
          onStep={(delta) => onWidthChange(side, Math.max(0, Math.min(100, width + delta * step)))}
          min={0}
          max={100}
          step={step}
          variant="desktop"
          ariaLabel={`${label} span`}
        />
      </div>
      {!hideDepth && (
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">{heightLabel}</span>
          <StepperControl
            value={depth}
            onChange={(v) => onDepthChange(side, v)}
            onStep={(delta) =>
              onDepthChange(side, Math.max(0, Math.min(100, depth + delta * step)))
            }
            min={0}
            max={100}
            step={step}
            variant="desktop"
            ariaLabel={`${label} height`}
          />
        </div>
      )}
    </div>
  );
}

/** Alignment + offset + width mode controls for a single side (outer walls only). */
function PositionControls({
  side,
  alignment,
  offset,
  widthMm,
  widthPct,
  onAlignmentChange,
  onOffsetChange,
  onWidthMmChange,
  onWidthPctChange,
  spanLabel,
  t,
  step,
}: {
  side: WallSide;
  alignment: LabelTabAlignment;
  offset: number;
  widthMm: number | null;
  widthPct: number;
  onAlignmentChange: (side: WallSide, alignment: LabelTabAlignment) => void;
  onOffsetChange: (side: WallSide, offset: number) => void;
  onWidthMmChange: (side: WallSide, widthMm: number | null) => void;
  onWidthPctChange: (side: WallSide, value: number) => void;
  spanLabel: string;
  t: (key: string) => string;
  step: number;
}) {
  const isMmMode = widthMm !== null;

  return (
    <div className="space-y-2">
      {/* Width mode toggle + span stepper */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">{spanLabel}</span>
          {isMmMode ? (
            <StepperControl
              value={widthMm}
              onChange={(v) => onWidthMmChange(side, Math.max(1, v))}
              onStep={(delta) => onWidthMmChange(side, Math.max(1, widthMm + delta))}
              min={1}
              max={500}
              step={1}
              variant="desktop"
              ariaLabel="Span mm"
            />
          ) : (
            <StepperControl
              value={widthPct}
              onChange={(v) => onWidthPctChange(side, v)}
              onStep={(delta) =>
                onWidthPctChange(side, Math.max(0, Math.min(100, widthPct + delta * step)))
              }
              min={0}
              max={100}
              step={step}
              variant="desktop"
              ariaLabel="Span %"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (isMmMode) {
              onWidthMmChange(side, null);
            } else {
              // Switch to mm mode with a sensible default
              onWidthMmChange(side, 30);
            }
          }}
          className={`shrink-0 rounded px-1.5 py-1 text-xs font-medium transition-colors ${
            isMmMode
              ? 'bg-accent text-on-accent'
              : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
          }`}
          title={
            isMmMode
              ? t('binDesigner.wallCutouts.widthUnit.percent')
              : t('binDesigner.wallCutouts.widthUnit.mm')
          }
        >
          {isMmMode
            ? t('binDesigner.wallCutouts.widthUnit.mm')
            : t('binDesigner.wallCutouts.widthUnit.percent')}
        </button>
      </div>

      {/* Alignment picker */}
      <div>
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.wallCutouts.position')}
        </span>
        <div className="flex gap-1">
          {ALIGNMENT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAlignmentChange(side, option)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                alignment === option
                  ? 'bg-accent text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.alignment.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Offset stepper — shown when not centered or has nonzero offset */}
      {(alignment !== 'center' || offset !== 0) && (
        <div>
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.wallCutouts.offset')}
          </span>
          <StepperControl
            value={offset}
            onChange={(v) => onOffsetChange(side, v)}
            onStep={(delta) => onOffsetChange(side, offset + delta * OFFSET_STEP)}
            min={-50}
            max={50}
            step={OFFSET_STEP}
            variant="desktop"
            ariaLabel="Offset mm"
          />
        </div>
      )}
    </div>
  );
}

export function WallCutoutsSection() {
  const { state, handlers, meta, t, STEP } = useWallCutoutsSection();
  const { walls, activeSides, linked } = state;

  // For linked mode, use first active side's values for the shared steppers
  const sharedSide = activeSides.length > 0 ? activeSides[0] : undefined;

  return (
    <FeatureToggle
      label={t('binDesigner.wallCutouts')}
      checked={walls.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      primaryControls={
        <div className="space-y-3">
          {/* Shape selector */}
          <div className="flex gap-1">
            {SHAPE_OPTIONS.map(({ value, labelKey }) => {
              const isActive = walls.shape === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlers.setShape(value)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {/* Side toggle chips */}
          <div className="flex gap-1">
            {SIDE_ORDER.map((side) => {
              const isActive = walls[side].enabled;
              return (
                <button
                  key={side}
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => handlers.toggleSide(side)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(`binDesigner.wallCutouts.${side}`)}
                </button>
              );
            })}
          </div>

          {/* Link/unlink toggle + steppers */}
          {activeSides.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlers.toggleLinked}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    linked
                      ? 'bg-accent/10 text-accent'
                      : 'bg-surface-secondary text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  <LinkIcon linked={linked} />
                  {linked
                    ? t('binDesigner.wallCutouts.linked')
                    : t('binDesigner.wallCutouts.independent')}
                </button>
              </div>

              {/* Shared controls (linked mode) */}
              {linked && sharedSide && (
                <>
                  <PositionControls
                    side={sharedSide}
                    alignment={walls[sharedSide].alignment}
                    offset={walls[sharedSide].offset}
                    widthMm={walls[sharedSide].widthMm}
                    widthPct={walls[sharedSide].width}
                    onAlignmentChange={handlers.setSideAlignment}
                    onOffsetChange={handlers.setSideOffset}
                    onWidthMmChange={handlers.setSideWidthMm}
                    onWidthPctChange={handlers.setSideWidth}
                    spanLabel={t('binDesigner.wallCutouts.span')}
                    t={t}
                    step={STEP}
                  />
                  {walls.shape !== 'scoop' && (
                    <div>
                      <span className="mb-1 block text-xs text-content-tertiary">
                        {t('binDesigner.wallCutouts.height')}
                      </span>
                      <StepperControl
                        value={walls[sharedSide].depth}
                        onChange={(v) => handlers.setSideDepth(sharedSide, v)}
                        onStep={(delta) =>
                          handlers.setSideDepth(
                            sharedSide,
                            Math.max(0, Math.min(100, walls[sharedSide].depth + delta * STEP))
                          )
                        }
                        min={0}
                        max={100}
                        step={STEP}
                        variant="desktop"
                        ariaLabel="Height %"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Per-side controls (independent mode) */}
              {!linked &&
                SIDE_ORDER.filter((side) => walls[side].enabled).map((side) => (
                  <div key={side} className="space-y-2">
                    <label className="text-xs font-medium text-content-secondary block">
                      {t(`binDesigner.wallCutouts.${side}`)}
                    </label>
                    <PositionControls
                      side={side}
                      alignment={walls[side].alignment}
                      offset={walls[side].offset}
                      widthMm={walls[side].widthMm}
                      widthPct={walls[side].width}
                      onAlignmentChange={handlers.setSideAlignment}
                      onOffsetChange={handlers.setSideOffset}
                      onWidthMmChange={handlers.setSideWidthMm}
                      onWidthPctChange={handlers.setSideWidth}
                      spanLabel={t('binDesigner.wallCutouts.span')}
                      t={t}
                      step={STEP}
                    />
                    {walls.shape !== 'scoop' && (
                      <div>
                        <span className="mb-1 block text-xs text-content-tertiary">
                          {t('binDesigner.wallCutouts.height')}
                        </span>
                        <StepperControl
                          value={walls[side].depth}
                          onChange={(v) => handlers.setSideDepth(side, v)}
                          onStep={(delta) =>
                            handlers.setSideDepth(
                              side,
                              Math.max(0, Math.min(100, walls[side].depth + delta * STEP))
                            )
                          }
                          min={0}
                          max={100}
                          step={STEP}
                          variant="desktop"
                          ariaLabel={`${t(`binDesigner.wallCutouts.${side}`)} height`}
                        />
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}

          {/* Interior walls */}
          <div className="border-t border-stroke-subtle/50 pt-2">
            <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={walls.interior.enabled}
                onChange={() => handlers.toggleSide('interior')}
                className="rounded border-stroke-subtle text-accent focus:ring-accent h-3.5 w-3.5"
              />
              {t('binDesigner.wallCutouts.interior')}
            </label>
            {walls.interior.enabled && !linked && (
              <div className="mt-2 ml-6">
                <SpanHeightSteppers
                  side="interior"
                  label={t('binDesigner.wallCutouts.interior')}
                  width={walls.interior.width}
                  depth={walls.interior.depth}
                  step={STEP}
                  onWidthChange={handlers.setSideWidth}
                  onDepthChange={handlers.setSideDepth}
                  spanLabel={t('binDesigner.wallCutouts.span')}
                  heightLabel={t('binDesigner.wallCutouts.height')}
                  hideDepth={walls.shape === 'scoop'}
                />
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
