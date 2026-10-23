/**
 * Text on the interior floor. The worker places it on the largest
 * clear stretch of floor; this section only edits the caption and its style.
 */

import { SegmentedControl } from '@/design-system';
import type { TextMode } from '@/features/bin-designer/types';
import { TEXT_QUARTER_TURNS, isTextQuarterTurn } from '@/features/bin-designer/types';
import type { TextSurface } from '@/features/bin-designer/utils/flatTextContrast';
import { FeatureToggle } from '../FeatureToggle';
import { CompartmentTextInput } from '../LabelTabsSection/CompartmentTextInput';
import { AnchorPicker } from '../../controls/AnchorPicker';
import { TextColorControl, TextFinishGrid } from '../shared';
import { useFloorTextSection } from './useFloorTextSection';

/** A floor has a base under it, so it offers no through-cut. */
const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss'] as const;
const FLOOR_SURFACE: readonly TextSurface[] = ['body'];

export function FloorTextSection() {
  const { t, state, handlers } = useFloorTextSection();
  const heading = t('binDesigner.floor.text.heading');
  const rotationLabel = t('binDesigner.lid.text.rotation');

  return (
    <FeatureToggle
      label={heading}
      checked={state.isOpen}
      onChange={handlers.toggle}
      disabledReason={state.disabledReason}
      info={t('binDesigner.floor.text.hint')}
      primaryControls={
        <>
          <CompartmentTextInput
            multiline
            committedValue={state.text}
            compartmentId={0}
            placeholder={t('binDesigner.walls.text.placeholder')}
            ariaLabel={heading}
            onCommit={handlers.commitText}
          />
          {state.hasText && (
            <>
              <TextFinishGrid
                modes={TEXT_MODE_OPTIONS}
                value={state.mode}
                onChange={handlers.setMode}
              />
              <TextColorControl surfaces={FLOOR_SURFACE} flat={state.mode === 'flat'} />
              <AnchorPicker
                value={state.anchor}
                onChange={handlers.setAnchor}
                label={t('binDesigner.floor.text.anchor')}
              />
              <div>
                <span className="mb-1 block text-xs font-medium text-content-secondary">
                  {rotationLabel}
                </span>
                <SegmentedControl
                  aria-label={rotationLabel}
                  activeStyle="accent"
                  fullWidth
                  size="sm"
                  value={String(state.rotation)}
                  onChange={(value) => {
                    const turn = Number(value);
                    if (isTextQuarterTurn(turn) && turn !== state.rotation) {
                      handlers.setRotation(turn);
                    }
                  }}
                  options={TEXT_QUARTER_TURNS.map((turn) => ({
                    value: String(turn),
                    label: t('binDesigner.lid.text.rotationOption', { angle: turn }),
                  }))}
                />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
