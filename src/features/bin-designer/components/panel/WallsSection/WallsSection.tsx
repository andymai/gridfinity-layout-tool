/**
 * Walls section: Wall thickness and pattern selection.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 *
 * Also allows selection of wall patterns (honeycomb, etc.) via dropdown, which
 * walls carry them, and their scale.
 */

import { SliderInput, SegmentedControl, Checkbox } from '@/design-system';
import type { TextMode } from '@/features/bin-designer/types';
import { WALL_PATTERN_SIDES, WALL_TEXT_SIDES } from '@/features/bin-designer/types';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';
import { WallCutoutsSection } from '../WallCutoutsSection';
import { HandleSection } from '../HandleSection';
import { SlideTraySection } from '../SlideTraySection';
import { FeatureToggle } from '../FeatureToggle';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';
import { AnchorPicker } from '../../controls/AnchorPicker';
import { SideSelector, type SideState } from '../shared';

/** Mode options for the wall-text picker, in the shared textMode order. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;

export function WallsSection() {
  const { state, handlers, t } = useWallsSection();
  // Wall cutouts and handles auto-snap to the outermost matching polygon
  // edge on custom shapes. Wall patterns tile across *every* axis-aligned
  // outer edge; outermost-per-cardinal matching is used only for border
  // clipping around cutouts/handles, not to limit tiling itself.

  // A slot-blocked wall can't carry a pattern, and SideSelector renders a
  // disabled side as off — so the stored selection passes through unchanged and
  // is restored the moment the slots go away.
  const patternSideStates: SideState[] = WALL_PATTERN_SIDES.map((side) => ({
    side,
    label: t(`binDesigner.lid.side.${side}`),
    active: state.patternSides[side],
    disabled: state.patternSideBlocked[side],
    title: state.patternSideBlocked[side]
      ? t('binDesigner.walls.pattern.sides.slotted')
      : undefined,
  }));

  return (
    <div className="space-y-4">
      <SnappingSlider
        label={t('binDesigner.wallThickness')}
        value={state.wallThickness}
        onChange={handlers.handleChange}
        options={state.options}
        unit="mm"
        tip={t('binDesigner.wallThickness.nozzleTip')}
      />
      <div>
        <PatternSelector
          selectedPattern={state.patternEnabled ? state.pattern : null}
          onChange={handlers.handlePatternChange}
          disabled={state.patternDisabled}
          disabledReason={state.patternDisabledReason}
        />
        {state.patternPartialNote && state.patternEnabled && (
          <p className="text-label text-content-tertiary mt-1">{state.patternPartialNote}</p>
        )}
        {state.patternEnabled && !state.patternDisabled && (
          <>
            <div className="mt-3">
              <SliderInput
                label={t('binDesigner.walls.pattern.scale')}
                value={state.patternScalePercent}
                onChange={handlers.handleScaleChange}
                min={0}
                max={100}
                step={5}
                unit="%"
                info={t('binDesigner.walls.pattern.scaleHint')}
              />
            </div>
            {/* ── Patterned walls (#2966) — pick which outer walls carry the
                pattern, same spatial selector the cutout/handle sections use.
                Suppressed when the pattern renders nothing on this bin, so the
                chips can't claim walls that export solid. */}
            {state.patternInertReason ? (
              <p className="mt-3 text-label leading-relaxed text-content-tertiary">
                {state.patternInertReason}
              </p>
            ) : (
              <div className="mt-3">
                <span className="mb-1 block text-xs text-content-secondary">
                  {t('binDesigner.walls.pattern.sides')}
                </span>
                <SideSelector
                  sides={patternSideStates}
                  onToggle={handlers.togglePatternSide}
                  ariaLabel={t('binDesigner.walls.pattern.sides')}
                />
                {state.patternSidesNote && (
                  <p className="mt-1 text-label leading-relaxed text-content-tertiary">
                    {state.patternSidesNote}
                  </p>
                )}
              </div>
            )}
            {/* ── Divider walls (#2811) — the same pattern and scale carried
                through the compartment dividers, so a patterned bin doesn't
                read as hollow walls around solid dividers. */}
            <div className="mt-3 border-t border-stroke-subtle/50 pt-2">
              <Checkbox
                checked={state.dividersEnabled}
                onChange={handlers.handleDividersChange}
                disabled={state.dividersAvailableReason !== undefined}
                label={t('binDesigner.walls.pattern.dividers')}
              />
              <p className="ml-6 mt-1 text-label leading-relaxed text-content-tertiary">
                {state.dividersAvailableReason ??
                  state.dividersNote ??
                  t('binDesigner.walls.pattern.dividersHint')}
              </p>
            </div>
          </>
        )}
      </div>
      {/* ── Wall text (#2695) — auto-fit surface text on the outer walls,
          gated behind a toggle like the sibling cutout/handle sections.
          The pattern is cleared behind the text; per-wall gates (slots)
          apply in the worker. */}
      <FeatureToggle
        label={t('binDesigner.walls.text.heading')}
        checked={state.isWallTextOpen}
        onChange={handlers.toggleWallText}
        disabledReason={state.wallTextDisabledReason}
        primaryControls={
          <>
            <div className="grid grid-cols-2 gap-2">
              {WALL_TEXT_SIDES.map((side, index) => (
                <div key={side}>
                  <span className="mb-1 block text-label text-content-tertiary">
                    {t(`binDesigner.lid.side.${side}`)}
                  </span>
                  <CompartmentTextInput
                    multiline
                    committedValue={state.wallTexts[side] ?? ''}
                    compartmentId={index}
                    placeholder={t('binDesigner.walls.text.placeholder')}
                    ariaLabel={t('binDesigner.walls.text.sideAria', {
                      side: t(`binDesigner.lid.side.${side}`),
                    })}
                    onCommit={handlers.commitWallTextAt}
                  />
                </div>
              ))}
            </div>
            {state.hasAnyWallText && (
              <>
                <SegmentedControl
                  aria-label={t('binDesigner.textMode')}
                  activeStyle="accent"
                  fullWidth
                  size="sm"
                  value={state.wallTextMode}
                  onChange={handlers.setTextMode}
                  options={TEXT_MODE_OPTIONS.map((mode) => ({
                    value: mode,
                    label: t(`binDesigner.textMode.${mode}`),
                  }))}
                />
                {state.wallTextMode === 'through-cut' && (
                  <p className="text-label leading-relaxed text-content-tertiary">
                    {t('binDesigner.textMode.throughCutStencilNote')}
                  </p>
                )}
                <div className="space-y-1">
                  <span className="block text-label text-content-tertiary">
                    {t('binDesigner.type.anchor')}
                  </span>
                  <AnchorPicker
                    value={state.wallTextAnchor}
                    onChange={handlers.setSurfaceTextAnchor}
                    label={t('binDesigner.walls.text.anchor')}
                  />
                </div>
                <p className="text-label leading-relaxed text-content-tertiary">
                  {t('binDesigner.walls.text.hint')}
                </p>
                <p className="text-label leading-relaxed text-content-tertiary">
                  {t('binDesigner.type.secondLineHint')}
                </p>
              </>
            )}
          </>
        }
      />
      <WallCutoutsSection />
      <HandleSection />
      <SlideTraySection />
    </div>
  );
}
