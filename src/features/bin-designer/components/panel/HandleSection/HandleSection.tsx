/**
 * Handle section: through-hole grip cutouts in bin walls.
 *
 * Controls: master toggle, shape picker, spatial side selector, linked/independent
 * mode, width/height/corner-radius steppers, collapsible vertical-position + count,
 * chamfer toggle, interior walls toggle. Shares its selectors, steppers, and
 * disclosure with the wall-cutout section via panel/shared so the two panels read
 * identically.
 */

import { FeatureToggle } from '../FeatureToggle';
import {
  ShapePicker,
  SideSelector,
  StepperField,
  AdvancedDisclosure,
  LinkIcon,
  type SideState,
} from '../shared';
import { RulerIcon } from '@/design-system/Icon';
import { Button } from '@/design-system';
import { clamp } from '@/shared/utils/math';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useHandleSection, HANDLE_SIDES } from './useHandleSection';
import type { HandleCutoutShape, HandleWallSide } from '@/features/bin-designer/types';

const C = DESIGNER_CONSTRAINTS;

const SHAPE_OPTIONS: readonly { value: HandleCutoutShape; labelKey: string }[] = [
  { value: 'rectangle', labelKey: 'binDesigner.handles.shape.rectangle' },
  { value: 'oval', labelKey: 'binDesigner.handles.shape.oval' },
  { value: 'scoop', labelKey: 'binDesigner.handles.shape.scoop' },
];

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

  const sideStates: SideState[] = HANDLE_SIDES.map((side) => {
    // The back handle is blocked while a label tab occupies that wall.
    // SideSelector renders a disabled side as off, so the stored `enabled`
    // flag can pass through unchanged.
    const isDisabled = side === 'back' && isBackDisabled;
    return {
      side,
      label: t(`binDesigner.handles.${side}`),
      active: handles[side].enabled,
      disabled: isDisabled,
      title: isDisabled ? t('binDesigner.handles.backDisabledByLabelTab') : undefined,
    };
  });

  /** Width (%) + height (mm) steppers for a single side or the shared config. */
  const renderSizeRow = (side: HandleWallSide | null) => {
    const width = side ? (handles[side].width ?? handles.width) : handles.width;
    const height = side ? (handles[side].height ?? handles.height) : handles.height;
    const setWidth = side ? (v: number) => handlers.setSideWidth(side, v) : handlers.setWidth;
    const setHeight = side ? (v: number) => handlers.setSideHeight(side, v) : handlers.setHeight;

    return (
      <div className="flex items-end gap-2">
        <StepperField
          label={t('binDesigner.handles.width')}
          unit="%"
          value={width}
          onChange={setWidth}
          onStep={(delta) =>
            setWidth(
              clamp(width + delta * C.HANDLE_WIDTH_STEP, C.MIN_HANDLE_WIDTH, C.MAX_HANDLE_WIDTH)
            )
          }
          min={C.MIN_HANDLE_WIDTH}
          max={C.MAX_HANDLE_WIDTH}
          step={C.HANDLE_WIDTH_STEP}
          size="md"
          aria-label={side ? `${side} handle width` : t('binDesigner.handles.widthAria')}
        />
        <StepperField
          label={t('binDesigner.handles.height')}
          unit="mm"
          value={height}
          onChange={setHeight}
          onStep={(delta) =>
            setHeight(
              clamp(height + delta * C.HANDLE_HEIGHT_STEP, C.MIN_HANDLE_HEIGHT, C.MAX_HANDLE_HEIGHT)
            )
          }
          min={C.MIN_HANDLE_HEIGHT}
          max={C.MAX_HANDLE_HEIGHT}
          step={C.HANDLE_HEIGHT_STEP}
          size="md"
          aria-label={side ? `${side} handle height` : t('binDesigner.handles.heightAria')}
        />
      </div>
    );
  };

  const vpPercent = Math.round(handles.verticalPosition * 100);
  const advancedSummary = `${vpPercent}%${handles.count > 1 ? ` ×${handles.count}` : ''}`;
  // Auto-expand the advanced controls when the user has moved off the defaults
  // (vertical position 0.7, single handle), so customizations are never hidden.
  const advancedForceOpen = handles.verticalPosition !== 0.7 || handles.count !== 1;

  return (
    <FeatureToggle
      label={t('binDesigner.handles')}
      checked={handles.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
      primaryControls={
        <div className="space-y-3">
          {/* Shape picker */}
          <ShapePicker
            options={SHAPE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            value={handles.shape}
            onChange={handlers.setShape}
            ariaLabel={t('binDesigner.handles.shape')}
          />

          {/* Spatial side selector */}
          <SideSelector
            sides={sideStates}
            onToggle={(side) => handlers.toggleSide(side)}
            ariaLabel={t('binDesigner.handles.sides')}
          />

          {/* Controls — shown when at least one side is active */}
          {activeSides.length > 0 && (
            <>
              {/* Linked/independent toggle */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlers.toggleLinked}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    linked
                      ? 'bg-accent/10 text-accent hover:bg-accent/10 hover:text-accent'
                      : 'bg-surface-secondary text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  <LinkIcon linked={linked} />
                  {linked ? t('binDesigner.handles.linked') : t('binDesigner.handles.independent')}
                </Button>
              </div>

              {/* Shared controls (linked mode) */}
              {linked && (
                <>
                  {renderSizeRow(null)}

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
                      <StepperField
                        label={t('binDesigner.handles.cornerRadius')}
                        unit="mm"
                        value={handles.cornerRadius}
                        onChange={handlers.setCornerRadius}
                        onStep={(delta) =>
                          handlers.setCornerRadius(
                            clamp(
                              handles.cornerRadius + delta * C.HANDLE_CORNER_RADIUS_STEP,
                              C.MIN_HANDLE_CORNER_RADIUS,
                              C.MAX_HANDLE_CORNER_RADIUS
                            )
                          )
                        }
                        min={C.MIN_HANDLE_CORNER_RADIUS}
                        max={C.MAX_HANDLE_CORNER_RADIUS}
                        step={C.HANDLE_CORNER_RADIUS_STEP}
                        size="md"
                        aria-label={t('binDesigner.handles.cornerRadiusAria')}
                      />
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
                    <label className="block text-xs font-medium text-content-secondary">
                      {t(`binDesigner.handles.${side}`)}
                    </label>
                    {renderSizeRow(side)}
                  </div>
                ))}

              {/* Advanced: vertical position + count, collapsible */}
              <AdvancedDisclosure
                label={`${t('binDesigner.handles.verticalPosition')}:`}
                summary={advancedSummary}
                forceOpen={advancedForceOpen}
              >
                <div className="flex items-end gap-2">
                  <StepperField
                    label={t('binDesigner.handles.verticalPosition')}
                    unit="%"
                    value={vpPercent}
                    onChange={(v) => handlers.setVerticalPosition(v / 100)}
                    onStep={(delta) => {
                      const step = C.HANDLE_VERTICAL_POSITION_STEP * 100;
                      handlers.setVerticalPosition(
                        clamp(
                          (vpPercent + delta * step) / 100,
                          C.MIN_HANDLE_VERTICAL_POSITION,
                          C.MAX_HANDLE_VERTICAL_POSITION
                        )
                      );
                    }}
                    min={Math.round(C.MIN_HANDLE_VERTICAL_POSITION * 100)}
                    max={Math.round(C.MAX_HANDLE_VERTICAL_POSITION * 100)}
                    step={Math.round(C.HANDLE_VERTICAL_POSITION_STEP * 100)}
                    size="md"
                    aria-label={t('binDesigner.handles.verticalPositionAria')}
                  />
                  <StepperField
                    label={t('binDesigner.handles.count')}
                    value={handles.count}
                    onChange={handlers.setCount}
                    onStep={(delta) =>
                      handlers.setCount(
                        clamp(handles.count + delta, C.MIN_HANDLE_COUNT, C.MAX_HANDLE_COUNT)
                      )
                    }
                    min={C.MIN_HANDLE_COUNT}
                    max={C.MAX_HANDLE_COUNT}
                    step={1}
                    size="md"
                    aria-label={t('binDesigner.handles.countAria')}
                  />
                </div>
              </AdvancedDisclosure>

              {/* Behavior toggles — separated visually */}
              <div className="space-y-2 border-t border-stroke-subtle/50 pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-content-secondary">
                  <input
                    type="checkbox"
                    checked={handles.chamfer}
                    onChange={handlers.toggleChamfer}
                    className="h-3.5 w-3.5 rounded border-stroke-subtle text-accent focus:ring-accent"
                  />
                  {t('binDesigner.handles.chamfer')}
                </label>

                {hasCompartments && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-content-secondary">
                    <input
                      type="checkbox"
                      checked={handles.interior}
                      onChange={handlers.toggleInterior}
                      className="h-3.5 w-3.5 rounded border-stroke-subtle text-accent focus:ring-accent"
                    />
                    {t('binDesigner.handles.interior')}
                  </label>
                )}
              </div>

              {/* FDM support note — contextual to active handles */}
              <p className="text-[11px] text-content-tertiary">
                {t('binDesigner.handles.supportNote')}
              </p>
            </>
          )}
        </div>
      }
    />
  );
}
