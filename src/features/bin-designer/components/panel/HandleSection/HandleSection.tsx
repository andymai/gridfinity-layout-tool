/**
 * Handle section: through-hole grip cutouts in bin walls.
 *
 * Controls: master toggle, shape selector, side chip toggles,
 * linked/independent mode, width/height/corner-radius/vertical position steppers,
 * count stepper, chamfer toggle, interior walls toggle.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import {
  getSegmentClass,
  SEGMENT_GROUP_CLASS,
  SEGMENT_ACTIVE,
  SEGMENT_INACTIVE,
} from '@/shared/components/segmentedControlClasses';
import { RulerIcon } from '@/design-system/Icon';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useHandleSection, HANDLE_SIDES } from './useHandleSection';
import type { HandleCutoutShape } from '@/features/bin-designer/types';

const C = DESIGNER_CONSTRAINTS;

const SHAPE_OPTIONS: readonly { value: HandleCutoutShape; labelKey: string }[] = [
  { value: 'rectangle', labelKey: 'binDesigner.handles.shape.rectangle' },
  { value: 'oval', labelKey: 'binDesigner.handles.shape.oval' },
  { value: 'scoop', labelKey: 'binDesigner.handles.shape.scoop' },
];

/** Inline SVG chain-link icon (12x12). */
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

/**
 * Side chip base dimensions. Matches the shape selector's segment pills
 * (px-2 py-1 text-xs rounded-md) so both rails read identically, but the
 * sides are independent on/off toggles — they use the accent-tint
 * SEGMENT_ACTIVE/SEGMENT_INACTIVE treatment instead of the single-select
 * raised pill (getSegmentClass).
 */
const SIDE_CHIP_BASE =
  'flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** Side chip button class based on state. */
function sideChipClass(isActive: boolean): string {
  return `${SIDE_CHIP_BASE} ${isActive ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`;
}

export function HandleSection() {
  const { state, handlers, meta, t } = useHandleSection();
  const {
    handles,
    isBackDisabled,
    handleWidthMm,
    linked,
    showCornerRadius,
    hasCompartments,
    activeSides,
  } = state;

  return (
    <FeatureToggle
      label={t('binDesigner.handles')}
      checked={handles.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
      primaryControls={
        <div className="space-y-3">
          {/* Shape selector */}
          <div
            role="group"
            aria-label={t('binDesigner.handles.shape')}
            className={SEGMENT_GROUP_CLASS}
          >
            {SHAPE_OPTIONS.map(({ value, labelKey }) => {
              const isActive = handles.shape === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handlers.setShape(value)}
                  className={`flex-1 ${getSegmentClass(isActive)}`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {/* Side toggle chips — same order as WallCutoutsSection: L R F B */}
          <div className={SEGMENT_GROUP_CLASS}>
            {HANDLE_SIDES.map((side) => {
              const isDisabled = side === 'back' && isBackDisabled;
              // A disabled side is functionally off (generation skips back
              // handles while a label tab is active), so present it as off —
              // neutral styling + aria-checked=false — even if its stored
              // `enabled` flag is still true. Otherwise the blocked chip reads
              // as "on" (accent tint), implying the setting is still in effect.
              const effectiveActive = handles[side].enabled && !isDisabled;
              return (
                <button
                  key={side}
                  type="button"
                  role="switch"
                  aria-checked={effectiveActive}
                  disabled={isDisabled}
                  title={isDisabled ? t('binDesigner.handles.backDisabledByLabelTab') : undefined}
                  onClick={() => handlers.toggleSide(side)}
                  className={`flex-1 ${sideChipClass(effectiveActive)}`}
                >
                  {t(`binDesigner.handles.${side}`)}
                </button>
              );
            })}
          </div>

          {/* Controls — shown when at least one side is active */}
          {activeSides.length > 0 && (
            <>
              {/* Linked/independent toggle */}
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
                  {linked ? t('binDesigner.handles.linked') : t('binDesigner.handles.independent')}
                </button>
              </div>

              {/* Shared controls (linked mode) */}
              {linked && (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="mb-1 block text-xs text-content-tertiary">
                        {}
                        {t('binDesigner.handles.width')} {'(%)'}
                      </span>
                      <StepperControl
                        value={handles.width}
                        onChange={handlers.setWidth}
                        onStep={(delta) =>
                          handlers.setWidth(
                            Math.min(
                              C.MAX_HANDLE_WIDTH,
                              Math.max(
                                C.MIN_HANDLE_WIDTH,
                                handles.width + delta * C.HANDLE_WIDTH_STEP
                              )
                            )
                          )
                        }
                        min={C.MIN_HANDLE_WIDTH}
                        max={C.MAX_HANDLE_WIDTH}
                        step={C.HANDLE_WIDTH_STEP}
                        variant="desktop"
                        ariaLabel={t('binDesigner.handles.widthAria')}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="mb-1 block text-xs text-content-tertiary">
                        {}
                        {t('binDesigner.handles.height')} {'(mm)'}
                      </span>
                      <StepperControl
                        value={handles.height}
                        onChange={handlers.setHeight}
                        onStep={(delta) =>
                          handlers.setHeight(
                            Math.min(
                              C.MAX_HANDLE_HEIGHT,
                              Math.max(
                                C.MIN_HANDLE_HEIGHT,
                                handles.height + delta * C.HANDLE_HEIGHT_STEP
                              )
                            )
                          )
                        }
                        min={C.MIN_HANDLE_HEIGHT}
                        max={C.MAX_HANDLE_HEIGHT}
                        step={C.HANDLE_HEIGHT_STEP}
                        variant="desktop"
                        ariaLabel={t('binDesigner.handles.heightAria')}
                      />
                    </div>
                  </div>

                  {/* Physical dimensions readout — hidden on custom shapes
                      where the actual span is a polygon edge, not the AABB. */}
                  {handleWidthMm !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                      <RulerIcon size="xs" />
                      <span className="tabular-nums">
                        {handleWidthMm} × {handles.height} mm
                      </span>
                    </div>
                  )}

                  {/* Corner radius — only for rectangle */}
                  {showCornerRadius && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="mb-1 block text-xs text-content-tertiary">
                          {}
                          {t('binDesigner.handles.cornerRadius')} {'(mm)'}
                        </span>
                        <StepperControl
                          value={handles.cornerRadius}
                          onChange={handlers.setCornerRadius}
                          onStep={(delta) =>
                            handlers.setCornerRadius(
                              Math.min(
                                C.MAX_HANDLE_CORNER_RADIUS,
                                Math.max(
                                  C.MIN_HANDLE_CORNER_RADIUS,
                                  handles.cornerRadius + delta * C.HANDLE_CORNER_RADIUS_STEP
                                )
                              )
                            )
                          }
                          min={C.MIN_HANDLE_CORNER_RADIUS}
                          max={C.MAX_HANDLE_CORNER_RADIUS}
                          step={C.HANDLE_CORNER_RADIUS_STEP}
                          variant="desktop"
                          ariaLabel={t('binDesigner.handles.cornerRadiusAria')}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Per-side controls (independent mode) */}
              {!linked &&
                HANDLE_SIDES.filter(
                  (s) => handles[s].enabled && !(s === 'back' && isBackDisabled)
                ).map((side) => (
                  <div key={side} className="space-y-2">
                    <label className="text-xs font-medium text-content-secondary block">
                      {t(`binDesigner.handles.${side}`)}
                    </label>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="mb-1 block text-xs text-content-tertiary">
                          {}
                          {t('binDesigner.handles.width')} {'(%)'}
                        </span>
                        <StepperControl
                          value={handles[side].width ?? handles.width}
                          onChange={(v) => handlers.setSideWidth(side, v)}
                          onStep={(delta) =>
                            handlers.setSideWidth(
                              side,
                              Math.min(
                                C.MAX_HANDLE_WIDTH,
                                Math.max(
                                  C.MIN_HANDLE_WIDTH,
                                  (handles[side].width ?? handles.width) +
                                    delta * C.HANDLE_WIDTH_STEP
                                )
                              )
                            )
                          }
                          min={C.MIN_HANDLE_WIDTH}
                          max={C.MAX_HANDLE_WIDTH}
                          step={C.HANDLE_WIDTH_STEP}
                          variant="desktop"
                          ariaLabel={`${side} handle width`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="mb-1 block text-xs text-content-tertiary">
                          {}
                          {t('binDesigner.handles.height')} {'(mm)'}
                        </span>
                        <StepperControl
                          value={handles[side].height ?? handles.height}
                          onChange={(v) => handlers.setSideHeight(side, v)}
                          onStep={(delta) =>
                            handlers.setSideHeight(
                              side,
                              Math.min(
                                C.MAX_HANDLE_HEIGHT,
                                Math.max(
                                  C.MIN_HANDLE_HEIGHT,
                                  (handles[side].height ?? handles.height) +
                                    delta * C.HANDLE_HEIGHT_STEP
                                )
                              )
                            )
                          }
                          min={C.MIN_HANDLE_HEIGHT}
                          max={C.MAX_HANDLE_HEIGHT}
                          step={C.HANDLE_HEIGHT_STEP}
                          variant="desktop"
                          ariaLabel={`${side} handle height`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

              {/* Global controls: vertical position + count (always visible, not per-side) */}
              <div className="flex items-end gap-2">
                {/* Vertical position */}
                <div className="flex-1 min-w-0">
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {}
                    {t('binDesigner.handles.verticalPosition')} {'(%)'}
                  </span>
                  <StepperControl
                    value={Math.round(handles.verticalPosition * 100)}
                    onChange={(v) => handlers.setVerticalPosition(v / 100)}
                    onStep={(delta) => {
                      const step = C.HANDLE_VERTICAL_POSITION_STEP * 100;
                      const current = Math.round(handles.verticalPosition * 100);
                      handlers.setVerticalPosition(
                        Math.min(
                          C.MAX_HANDLE_VERTICAL_POSITION,
                          Math.max(C.MIN_HANDLE_VERTICAL_POSITION, (current + delta * step) / 100)
                        )
                      );
                    }}
                    min={Math.round(C.MIN_HANDLE_VERTICAL_POSITION * 100)}
                    max={Math.round(C.MAX_HANDLE_VERTICAL_POSITION * 100)}
                    step={Math.round(C.HANDLE_VERTICAL_POSITION_STEP * 100)}
                    variant="desktop"
                    ariaLabel={t('binDesigner.handles.verticalPositionAria')}
                  />
                </div>

                {/* Count stepper — shares row with vertical position */}
                <div className="flex-1 min-w-0">
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.handles.count')}
                  </span>
                  <StepperControl
                    value={handles.count}
                    onChange={handlers.setCount}
                    onStep={(delta) =>
                      handlers.setCount(
                        Math.min(
                          C.MAX_HANDLE_COUNT,
                          Math.max(C.MIN_HANDLE_COUNT, handles.count + delta)
                        )
                      )
                    }
                    min={C.MIN_HANDLE_COUNT}
                    max={C.MAX_HANDLE_COUNT}
                    step={1}
                    variant="desktop"
                    ariaLabel={t('binDesigner.handles.countAria')}
                  />
                </div>
              </div>

              {/* Behavior toggles — separated visually */}
              <div className="border-t border-stroke-subtle/50 pt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={handles.chamfer}
                    onChange={handlers.toggleChamfer}
                    className="rounded border-stroke-subtle text-accent focus:ring-accent h-3.5 w-3.5"
                  />
                  {t('binDesigner.handles.chamfer')}
                </label>

                {hasCompartments && (
                  <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handles.interior}
                      onChange={handlers.toggleInterior}
                      className="rounded border-stroke-subtle text-accent focus:ring-accent h-3.5 w-3.5"
                    />
                    {t('binDesigner.handles.interior')}
                  </label>
                )}
              </div>
            </>
          )}

          {/* FDM support note */}
          <p className="text-[11px] text-content-tertiary">
            {t('binDesigner.handles.supportNote')}
          </p>
        </div>
      }
    />
  );
}
