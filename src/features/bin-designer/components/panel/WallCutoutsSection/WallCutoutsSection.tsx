/**
 * Wall cutouts section: U-shaped notches from the top of bin walls.
 *
 * Controls: master toggle, global width/depth sliders, per-side toggles
 * with optional per-side width/depth overrides, interior walls toggle.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import type { WallSide } from '@/features/bin-designer/types';

function SideOverride({
  side,
  label,
  enabled,
  width,
  depth,
  step,
  onToggle,
  onWidthChange,
  onDepthChange,
  widthLabel,
  depthLabel,
}: {
  side: WallSide;
  label: string;
  enabled: boolean;
  width: number;
  depth: number;
  step: number;
  onToggle: (side: WallSide) => void;
  onWidthChange: (side: WallSide, value: number) => void;
  onDepthChange: (side: WallSide, value: number) => void;
  widthLabel: string;
  depthLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[11px] text-content-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onToggle(side)}
          className="rounded border-stroke-subtle text-accent focus:ring-accent h-3.5 w-3.5"
        />
        {label}
      </label>
      {enabled && (
        <div className="ml-5 space-y-1.5">
          <div>
            <span className="text-[10px] text-content-tertiary">{widthLabel}</span>
            <StepperControl
              value={width}
              onChange={(v) => onWidthChange(side, v)}
              onStep={(delta) =>
                onWidthChange(side, Math.max(0, Math.min(100, width + delta * step)))
              }
              min={0}
              max={100}
              step={step}
              variant="desktop"
              ariaLabel={`${label} width`}
            />
          </div>
          <div>
            <span className="text-[10px] text-content-tertiary">{depthLabel}</span>
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
              ariaLabel={`${label} depth`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function WallCutoutsSection() {
  const { state, handlers, meta, t, STEP, OUTER_SIDES } = useWallCutoutsSection();

  return (
    <FeatureToggle
      label={t('binDesigner.wallCutouts')}
      checked={state.walls.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      primaryControls={
        <div className="space-y-3">
          {/* Global width/depth sliders */}
          <div>
            <span className="text-[11px] text-content-tertiary">
              {t('binDesigner.wallCutouts.width')}
            </span>
            <StepperControl
              value={state.walls.width}
              onChange={handlers.setGlobalWidth}
              onStep={(delta) =>
                handlers.setGlobalWidth(
                  Math.max(0, Math.min(100, state.walls.width + delta * STEP))
                )
              }
              min={0}
              max={100}
              step={STEP}
              variant="desktop"
              ariaLabel="Global cutout width"
            />
          </div>
          <div>
            <span className="text-[11px] text-content-tertiary">
              {t('binDesigner.wallCutouts.depth')}
            </span>
            <StepperControl
              value={state.walls.depth}
              onChange={handlers.setGlobalDepth}
              onStep={(delta) =>
                handlers.setGlobalDepth(
                  Math.max(0, Math.min(100, state.walls.depth + delta * STEP))
                )
              }
              min={0}
              max={100}
              step={STEP}
              variant="desktop"
              ariaLabel="Global cutout depth"
            />
          </div>

          {/* Per-side toggles with optional overrides */}
          <div className="border-t border-stroke-subtle/50 pt-2 space-y-2">
            <span className="text-[11px] font-medium text-content-secondary">
              {t('binDesigner.wallCutouts.customize')}
            </span>
            {OUTER_SIDES.map((side) => (
              <SideOverride
                key={side}
                side={side}
                label={t(`binDesigner.wallCutouts.${side}`)}
                enabled={state.walls[side].enabled}
                width={state.walls[side].width}
                depth={state.walls[side].depth}
                step={STEP}
                onToggle={handlers.toggleSide}
                onWidthChange={handlers.setSideWidth}
                onDepthChange={handlers.setSideDepth}
                widthLabel={t('binDesigner.wallCutouts.width')}
                depthLabel={t('binDesigner.wallCutouts.depth')}
              />
            ))}

            {/* Interior walls */}
            <SideOverride
              side="interior"
              label={t('binDesigner.wallCutouts.interior')}
              enabled={state.walls.interior.enabled}
              width={state.walls.interior.width}
              depth={state.walls.interior.depth}
              step={STEP}
              onToggle={handlers.toggleSide}
              onWidthChange={handlers.setSideWidth}
              onDepthChange={handlers.setSideDepth}
              widthLabel={t('binDesigner.wallCutouts.width')}
              depthLabel={t('binDesigner.wallCutouts.depth')}
            />
          </div>
        </div>
      }
    />
  );
}
