/**
 * Grip relief controls — the answer to "the lid fits so well I needed
 * a screwdriver".
 *
 * Lives beside `LidSection` rather than inside it: the mode/sides/coverage
 * trio plus the effective readout is a block of its own, and folding it back
 * in pushed that file well past the 500-line ceiling.
 */
import { Button, Checkbox } from '@/design-system';
import { LID_RAIL_SIDES, lidGripHeightAdjustable } from '@/features/bin-designer/types';
import type { LidGripSides, LidRailSide } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { Hint, Readout, SegmentGrid, StepperField } from '../shared';
import type { useLidSection } from '../LidSection/useLidSection';

type Translator = ReturnType<typeof useTranslation>;

/**
 * Per-side grip-relief toggles. Same multi-select shape as `RailSides`,
 * minus the auto-disable: nothing in the design can conflict with a relief on
 * a given wall, so the only thing that turns one off is the user.
 */
function GripSides({
  sides,
  onToggle,
  t,
}: {
  sides: LidGripSides;
  onToggle: (side: LidRailSide) => void;
  t: Translator;
}) {
  return (
    <div>
      <span className="mb-1 block text-label text-content-tertiary">
        {t('binDesigner.lid.gripSides')}
      </span>
      <div className="flex gap-1">
        {LID_RAIL_SIDES.map((side) => {
          const isActive = sides[side];
          return (
            <Button
              key={side}
              type="button"
              variant="ghost"
              role="switch"
              aria-checked={isActive}
              onClick={() => onToggle(side)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.side.${side}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The effective readout is the point of this block, not decoration: depth and
 * height are both clamped by the design's own geometry, and a relief that came
 * out shallower than its mode asks for reads as a defect unless the panel says
 * which dimension ran out.
 */
export function LidGripControls({
  state,
  handlers,
  t,
}: {
  state: ReturnType<typeof useLidSection>['state'];
  handlers: ReturnType<typeof useLidSection>['handlers'];
  t: Translator;
}) {
  const { grip, gripDepth, gripHeight } = state;
  const modeSelected = grip.mode !== 'none';
  const modeAllowed = state.gripModeAllowed(grip.mode);
  // A chamfer's 45° section is its depth, so it has no independent height to
  // set, and `lidGripRequestedHeightMm` ignores a stored value there. One
  // predicate decides both, or the panel offers a field that does nothing.
  const heightAdjustable = lidGripHeightAdjustable(grip.mode);
  return (
    <div className="space-y-2">
      <span className="mb-1 block text-label text-content-tertiary">
        {t('binDesigner.lid.gripMode')}
      </span>
      <SegmentGrid
        aria-label={t('binDesigner.lid.gripMode')}
        value={grip.mode}
        onChange={handlers.setGripMode}
        options={state.gripModes.map((mode) => ({
          value: mode,
          label: t(`binDesigner.lid.gripMode.${mode}`),
          disabled: !state.gripModeAllowed(mode),
        }))}
      />
      {modeSelected && !modeAllowed && <Hint>{t('binDesigner.lid.gripModeStackConflict')}</Hint>}

      {modeSelected && modeAllowed && (
        <>
          <GripSides sides={grip.sides} onToggle={handlers.toggleGripSide} t={t} />
          {!state.gripAnySide && <Hint>{t('binDesigner.lid.gripNoSides')}</Hint>}

          <SnappingSlider
            label={t('binDesigner.lid.gripCoverage')}
            value={grip.coverage}
            onChange={handlers.setGripCoverage}
            options={state.gripCoverageOptions}
            unit="%"
          />

          {heightAdjustable && (
            <div className="flex items-end gap-2">
              <StepperField
                label={t('binDesigner.lid.gripHeight')}
                unit="mm"
                // The auto height is a REQUEST: on a standard lid the skirt
                // clamps it well short. Showing the request rather than the
                // resolved height keeps the field agreeing with the number
                // the user typed; the readout below reports what was cut.
                value={gripHeight.requestedMm}
                onChange={handlers.setGripHeight}
                onStep={(delta) =>
                  handlers.setGripHeight(gripHeight.requestedMm + delta * state.gripHeightStep)
                }
                min={state.gripHeightMin}
                max={state.gripHeightMax}
                step={state.gripHeightStep}
                size="md"
                aria-label={t('binDesigner.lid.gripHeight')}
                commitMode="deferred"
              />
              {grip.heightMm !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handlers.setGripHeight(null)}
                  className="mb-1 shrink-0 rounded px-2 py-1 text-xs font-medium text-content-secondary"
                >
                  {t('binDesigner.lid.gripHeightAuto')}
                </Button>
              )}
            </div>
          )}

          {state.gripActive && (
            <Readout>
              {t('binDesigner.lid.gripEffective', {
                depth: gripDepth.depthMm.toFixed(1),
                height: gripHeight.heightMm.toFixed(1),
                skin: gripHeight.skinMm.toFixed(1),
              })}
            </Readout>
          )}
          {gripDepth.clamped && gripDepth.limitedBy && (
            <Hint>{t(`binDesigner.lid.gripClamped.${gripDepth.limitedBy}`)}</Hint>
          )}
          {/* Only the skirt bound gets its own line: a chamfer cut short by the
              depth clamp is already explained by the hint above it. */}
          {state.gripActive && gripHeight.limitedBy === 'skirt' && (
            <Hint>
              {t('binDesigner.lid.gripHeightClamped', {
                skirt: gripHeight.skirtMm.toFixed(1),
              })}
            </Hint>
          )}

          <div>
            {/* `items-start` overrides the component's centring: this label is long
                enough to wrap, and centring would put the box beside the middle
                line. No nudge needed — text-xs and the box are both 16px tall. */}
            <Checkbox
              className="items-start"
              checked={grip.binDip}
              onChange={handlers.toggleGripBinDip}
              label={t('binDesigner.lid.gripBinDip')}
            />
            {/* Outside the label: `Hint` is a <p>, which cannot nest in a <span>. */}
            <Hint>{t('binDesigner.lid.gripBinDipWarning')}</Hint>
          </div>
        </>
      )}
    </div>
  );
}
