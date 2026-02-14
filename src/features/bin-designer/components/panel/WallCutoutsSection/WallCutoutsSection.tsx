/**
 * Wall cutouts section: U-shaped notches from the top of bin walls.
 *
 * Controls: master toggle, toggle chip row (L/R/F/B), linked/independent mode,
 * shared or per-side span/height steppers, interior checkbox.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import type { WallSide, WallCutoutShape } from '@/features/bin-designer/types';

const SIDE_ORDER: readonly Exclude<WallSide, 'interior'>[] = ['left', 'right', 'front', 'back'];

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

              {/* Shared steppers (linked mode) */}
              {linked && sharedSide && (
                <SpanHeightSteppers
                  side={sharedSide}
                  label={t('binDesigner.wallCutouts')}
                  width={walls[sharedSide].width}
                  depth={walls[sharedSide].depth}
                  step={STEP}
                  onWidthChange={handlers.setSideWidth}
                  onDepthChange={handlers.setSideDepth}
                  spanLabel={t('binDesigner.wallCutouts.span')}
                  heightLabel={t('binDesigner.wallCutouts.height')}
                  hideDepth={walls.shape === 'scoop'}
                />
              )}

              {/* Per-side steppers (independent mode) */}
              {!linked &&
                SIDE_ORDER.filter((side) => walls[side].enabled).map((side) => (
                  <div key={side}>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      {t(`binDesigner.wallCutouts.${side}`)}
                    </label>
                    <SpanHeightSteppers
                      side={side}
                      label={t(`binDesigner.wallCutouts.${side}`)}
                      width={walls[side].width}
                      depth={walls[side].depth}
                      step={STEP}
                      onWidthChange={handlers.setSideWidth}
                      onDepthChange={handlers.setSideDepth}
                      spanLabel={t('binDesigner.wallCutouts.span')}
                      heightLabel={t('binDesigner.wallCutouts.height')}
                      hideDepth={walls.shape === 'scoop'}
                    />
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
