/**
 * Grip relief controls (#3272) — the answer to "the lid fits so well I needed
 * a screwdriver".
 *
 * Lives beside `LidSection` rather than inside it: the mode/sides/coverage
 * trio plus the effective readout is a block of its own, and folding it back
 * in pushed that file well past the 500-line ceiling.
 */
import { Button, SegmentedControl } from '@/design-system';
import { LID_RAIL_SIDES } from '@/features/bin-designer/types';
import type { LidGripSides, LidRailSide } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { Hint, Readout } from '../shared';
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
      <span className="mb-1 block text-xs font-medium text-content-secondary">
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
  const { grip, gripDepth } = state;
  const modeSelected = grip.mode !== 'none';
  const modeAllowed = state.gripModeAllowed(grip.mode);
  return (
    <div className="space-y-2">
      <span className="mb-1 block text-xs font-medium text-content-secondary">
        {t('binDesigner.lid.gripMode')}
      </span>
      <SegmentedControl
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

          {state.gripActive && (
            <Readout>
              {t('binDesigner.lid.gripEffective', {
                depth: gripDepth.depthMm.toFixed(1),
                height: state.gripHeightMm.toFixed(1),
              })}
            </Readout>
          )}
          {gripDepth.clamped && gripDepth.limitedBy && (
            <Hint>{t(`binDesigner.lid.gripClamped.${gripDepth.limitedBy}`)}</Hint>
          )}

          <label className="flex items-start gap-2 text-xs text-content-secondary">
            <input
              type="checkbox"
              checked={grip.binDip}
              onChange={handlers.toggleGripBinDip}
              className="mt-0.5"
            />
            <span>
              {t('binDesigner.lid.gripBinDip')}
              <Hint>{t('binDesigner.lid.gripBinDipWarning')}</Hint>
            </span>
          </label>
        </>
      )}
    </div>
  );
}
