/**
 * Walls section: Wall thickness and pattern selection.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 *
 * Also allows selection of wall patterns (honeycomb, etc.) via dropdown.
 */

import { SliderInput, SegmentedControl } from '@/design-system';
import type { TextMode } from '@/features/bin-designer/types';
import { WALL_TEXT_SIDES, WALL_TEXT_ALIGNS } from '@/features/bin-designer/types';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';
import { WallCutoutsSection } from '../WallCutoutsSection';
import { HandleSection } from '../HandleSection';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';

/** Mode options for the wall-text picker, in the shared textMode order. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;

export function WallsSection() {
  const { state, handlers, t } = useWallsSection();
  // Wall cutouts and handles auto-snap to the outermost matching polygon
  // edge on custom shapes. Wall patterns tile across *every* axis-aligned
  // outer edge; outermost-per-cardinal matching is used only for border
  // clipping around cutouts/handles, not to limit tiling itself.

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
          <p className="text-[11px] text-content-tertiary mt-1">{state.patternPartialNote}</p>
        )}
        {state.patternEnabled && !state.patternDisabled && (
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
        )}
      </div>
      {/* ── Wall text (#2695) — auto-fit surface text on the outer walls.
          Sits next to the pattern selector because the pattern is cleared
          behind the text; per-wall gates (slots) apply in the worker. */}
      <div className="space-y-2">
        <span className="block text-xs font-medium text-content-secondary">
          {t('binDesigner.walls.text.heading')}
        </span>
        {state.wallTextDisabledReason ? (
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            {state.wallTextDisabledReason}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {WALL_TEXT_SIDES.map((side, index) => (
                <div key={side}>
                  <span className="mb-1 block text-[11px] text-content-tertiary">
                    {t(`binDesigner.lid.side.${side}`)}
                  </span>
                  <CompartmentTextInput
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
                  <p className="text-[11px] leading-relaxed text-content-tertiary">
                    {t('binDesigner.textMode.throughCutStencilNote')}
                  </p>
                )}
                <SegmentedControl
                  aria-label={t('binDesigner.walls.text.align')}
                  activeStyle="accent"
                  fullWidth
                  size="sm"
                  value={state.wallTextAlign}
                  onChange={handlers.setWallTextAlign}
                  options={WALL_TEXT_ALIGNS.map((align) => ({
                    value: align,
                    label: t(`binDesigner.walls.text.align.${align}`),
                  }))}
                />
                <p className="text-[11px] leading-relaxed text-content-tertiary">
                  {t('binDesigner.walls.text.hint')}
                </p>
              </>
            )}
          </>
        )}
      </div>
      <WallCutoutsSection />
      <HandleSection />
    </div>
  );
}
