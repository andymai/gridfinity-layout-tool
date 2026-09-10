/**
 * Label tabs section.
 *
 * Ordered content-first: the label type (what the captions become) and then the
 * captions themselves. Everything below is how they are shaped, and the bulky
 * geometry and text styling fold into collapsed groups so the default view is
 * the text and little else.
 */

import { useCallback, useState } from 'react';
import { FeatureToggle } from '../FeatureToggle';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { Button, Stepper, InfoIcon, Collapsible } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import type { LabelTabAlignment, LabelTabEdges } from '../../../types';
import {
  LABEL_PLATE_FIT_OFFSET_MAX,
  LABEL_PLATE_FIT_OFFSET_MIN,
  LABEL_PLATE_FIT_OFFSET_STEP,
} from '@/shared/constants/labelPlates';
import type { LabelSocketStyle } from '@/shared/constants/labelPlates';
import { LabelTextList } from './LabelTextList';
import { LabelSectionWarnings } from './LabelSectionWarnings';
import { LabelColorControls } from './LabelColorControls';
import { LabelPlatesControls } from './LabelPlatesControls';
import { LabelFitSampleButton } from './LabelFitSampleButton';
import { useLabelTabsSection } from './useLabelTabsSection';
import type { LabelWarningGroup } from './useLabelTabsSection';
import type { LabelTabMode } from '../../../types';
import { LabelTabShapeControls } from './LabelTabShapeControls';
import { LabelTabTextStyleControls } from './LabelTabTextStyleControls';

const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const EDGES_OPTIONS: LabelTabEdges[] = ['back', 'front', 'both'];
const TAB_MODE_OPTIONS: LabelTabMode[] = ['text', 'socket'];
const SOCKET_STYLE_OPTIONS: readonly LabelSocketStyle[] = ['clickIn', 'slideChannel'];

/** Collapsible groups below the label text. Every one starts closed: the text
 *  IS the section, and these are how it gets shaped. */
type LabelGroupId = LabelWarningGroup | 'text' | 'colors' | 'plateFit';
const EMPTY_GROUPS: ReadonlySet<LabelGroupId> = new Set();

export function LabelTabsSection() {
  const { state, handlers, meta, t } = useLabelTabsSection();

  // Controlled rather than `defaultExpanded`, so a warning's jump link can open
  // the group that owns its control.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<LabelGroupId>>(EMPTY_GROUPS);
  const setGroupExpanded = useCallback((group: LabelGroupId, open: boolean) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(group);
      else next.delete(group);
      return next;
    });
  }, []);
  const expandGroup = useCallback(
    (group: LabelWarningGroup) => setGroupExpanded(group, true),
    [setGroupExpanded]
  );

  const groupTitles = {
    placement: t('binDesigner.labelPlacementGroup'),
    shape: t('binDesigner.tabShapeGroup'),
    text: t('binDesigner.tabEngravedText'),
    colors: t('binDesigner.labelColorsGroup'),
  } as const;

  // tabHeightMm is a resolved plane, not the typed value — round it like
  // tabWidthMm so a fractional shelf can't print its full float expansion.
  const dimensionsReadout = `${state.tabWidthMm} × ${state.label.depth}${
    state.heightIsExplicit ? ` × ${Math.round(state.tabHeightMm * 10) / 10}` : ''
  } mm`;

  const plateFitReadout = [
    t(`binDesigner.socketStyle.${state.label.socketStyle ?? 'clickIn'}`),
    // Technical readout, deliberately untranslated.
    `${(state.label.plateFitOffset ?? 0).toFixed(2)} mm`,
  ].join(' · ');

  const placementReadout = [
    t(`binDesigner.tabEdges.${state.label.edges ?? 'back'}`),
    state.spanning ? t('binDesigner.labelTextPerRow') : t('binDesigner.labelTextPerCompartment'),
  ].join(' · ');

  // Technical readout, deliberately untranslated (same convention as
  // dimensionsReadout) apart from the font's own display name.
  const textStyleReadout = `${t(`binDesigner.type.font.${state.textDefaults.font}`)} · ${
    state.textDefaults.depth
  } mm`;

  // Marks a collapsed group holding an active warning. The message itself has
  // already escaped to section level; this is what ties it back to its home.
  const warningBadge = (group: LabelWarningGroup) =>
    state.warnings.some((w) => w.group === group) && !expandedGroups.has(group) ? (
      <InfoIcon size="xs" className="text-warning" />
    ) : undefined;

  // The list stays in `primaryControls` rather than a Customize child: that area
  // is clipped at a fixed max-height/overflow-hidden, so a long list (up to 144
  // rows) would be cut off. Here it flows full-height under the panel's scrollbar.
  const labelText = (
    <LabelTextList
      rows={state.textRows}
      spanning={state.spanning}
      onToggleSpan={handlers.toggleSpan}
      onCommit={handlers.commitText}
      onClearAll={handlers.clearAllText}
      onWiden={state.canWidenTabs ? handlers.widenTabs : undefined}
      focusIndex={state.spanning ? null : state.labelFocusCompartmentId}
      onFocusChange={state.spanning ? undefined : handlers.setLabelFocusCompartmentId}
      onPickOnGrid={state.spanning ? undefined : handlers.pickLabelOnGrid}
      onPlateWidthChange={handlers.setCompartmentPlateWidth}
      onPlateIconChange={handlers.setCompartmentPlateIcon}
      suggestedName={state.binNameSuggestion?.name}
      onApplySuggestedName={handlers.applyBinNameSuggestion}
    />
  );

  return (
    <FeatureToggle
      label={t('binDesigner.labelTabs')}
      checked={state.label.enabled}
      onChange={handlers.toggleLabelTabs}
      disabledReason={meta.disabledReason}
      primaryControls={
        <>
          {/* Label type leads because it decides what the captions below become:
              cut into the bin, or engraved on separately printed plates (#2666)
              — which in socket mode also gives each row a plate to size. */}
          <div>
            <span className="mb-1 block text-label text-content-tertiary">
              {t('binDesigner.tabMode')}
            </span>
            <div role="group" aria-label={t('binDesigner.tabMode')} className={SEGMENT_GROUP_CLASS}>
              {TAB_MODE_OPTIONS.map((option) => {
                const current = state.label.mode ?? 'text';
                const socketDisabled = option === 'socket' && state.socketUnavailable;
                return (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    touchTarget={false}
                    onClick={() => handlers.setTabMode(option)}
                    aria-pressed={current === option}
                    disabled={socketDisabled}
                    title={socketDisabled ? t('binDesigner.tabMode.socketTooNarrow') : undefined}
                    className={`flex-1 ${getSegmentClass(current === option)}`}
                  >
                    {t(`binDesigner.tabMode.${option}`)}
                  </Button>
                );
              })}
            </div>
            {state.isSocketMode && (
              <p className="mt-1 flex items-start gap-1 text-xs text-content-tertiary">
                <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                <span>{t('binDesigner.tabMode.socketHint')}</span>
              </p>
            )}
          </div>

          {labelText}

          {state.isSocketMode && (
            <>
              <div>
                <span className="mb-1 block text-label text-content-tertiary">
                  {t('binDesigner.socketStyle')}
                </span>
                <div
                  role="group"
                  aria-label={t('binDesigner.socketStyle')}
                  className={SEGMENT_GROUP_CLASS}
                >
                  {SOCKET_STYLE_OPTIONS.map((option) => {
                    const current = state.label.socketStyle ?? 'clickIn';
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        touchTarget={false}
                        onClick={() => handlers.setSocketStyle(option)}
                        aria-pressed={current === option}
                        className={`flex-1 ${getSegmentClass(current === option)}`}
                      >
                        {t(`binDesigner.socketStyle.${option}`)}
                      </Button>
                    );
                  })}
                </div>
                {(state.label.socketStyle ?? 'clickIn') === 'slideChannel' && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-content-tertiary">
                    <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                    <span>{t('binDesigner.socketStyle.slideHint')}</span>
                  </p>
                )}
              </div>
              {state.socketSpanningWidthU !== null && (
                <p className="flex items-start gap-1 text-xs text-content-tertiary">
                  <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                  <span>{t('binDesigner.plateSpanningNote')}</span>
                </p>
              )}
              {/* The preview tessellates a bounded number of plates so a large
                  grid can't stall the editing loop — say so rather than let a
                  partial set look like the whole design. */}
              {state.omittedPlateCount > 0 && (
                <p className="flex items-start gap-1 text-xs text-content-tertiary">
                  <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                  <span>
                    {t('binDesigner.labelPlatesOmitted', {
                      shown: state.shownPlateCount,
                      total: state.shownPlateCount + state.omittedPlateCount,
                    })}
                  </span>
                </p>
              )}
              <Collapsible
                title={t('binDesigner.plateFitGroup')}
                summary={plateFitReadout}
                expanded={expandedGroups.has('plateFit')}
                onExpandedChange={(open) => setGroupExpanded('plateFit', open)}
                size="sm"
              >
                <div className="min-w-0">
                  <span className="mb-1 flex items-center gap-1 text-xs font-medium text-content-secondary">
                    {t('binDesigner.plateFitOffset')}
                    <span title={t('binDesigner.plateFitOffsetHint')} className="inline-flex">
                      <InfoIcon size="xs" className="text-content-tertiary" />
                    </span>
                  </span>
                  <Stepper
                    value={state.label.plateFitOffset ?? 0}
                    onChange={handlers.setPlateFitOffset}
                    onStep={(delta) =>
                      handlers.setPlateFitOffset(
                        Math.round(
                          Math.min(
                            LABEL_PLATE_FIT_OFFSET_MAX,
                            Math.max(
                              LABEL_PLATE_FIT_OFFSET_MIN,
                              (state.label.plateFitOffset ?? 0) +
                                delta * LABEL_PLATE_FIT_OFFSET_STEP
                            )
                          ) * 100
                        ) / 100
                      )
                    }
                    min={LABEL_PLATE_FIT_OFFSET_MIN}
                    max={LABEL_PLATE_FIT_OFFSET_MAX}
                    step={LABEL_PLATE_FIT_OFFSET_STEP}
                    // Without 2-decimal rendering the default toFixed(1) shows
                    // every 0.05 step as its 0.1 neighbor — the control looks
                    // stuck even though the store moves in 0.05 increments.
                    inputDecimals={2}
                    size="md"
                    aria-label={t('binDesigner.plateFitOffset')}
                  />
                </div>
                <LabelFitSampleButton />
                <LabelPlatesControls />
              </Collapsible>
            </>
          )}

          <LabelSectionWarnings
            warnings={state.warnings}
            expandedGroups={expandedGroups}
            onJumpToGroup={expandGroup}
            groupTitles={groupTitles}
          />

          {/* Placement: which edges carry a tab, and where the tab sits across
              its compartment. Both answer "where does the label go". */}
          <Collapsible
            title={groupTitles.placement}
            summary={placementReadout}
            expanded={expandedGroups.has('placement')}
            onExpandedChange={(open) => setGroupExpanded('placement', open)}
            size="sm"
            badge={warningBadge('placement')}
          >
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-label text-content-tertiary">
                  {t('binDesigner.tabEdges')}
                </span>
                <div
                  role="group"
                  aria-label={t('binDesigner.tabEdges')}
                  className={SEGMENT_GROUP_CLASS}
                >
                  {EDGES_OPTIONS.map((option) => {
                    const current = state.label.edges ?? 'back';
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        touchTarget={false}
                        onClick={() => handlers.setTabEdges(option)}
                        aria-pressed={current === option}
                        className={`flex-1 ${getSegmentClass(current === option)}`}
                      >
                        {t(`binDesigner.tabEdges.${option}`)}
                      </Button>
                    );
                  })}
                </div>
                {state.tabsWillSilentlyDrop && (
                  <div className="mt-1 flex items-start gap-2 text-xs text-warning">
                    <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                    <span className="flex-1">{t('binDesigner.tabBothCollisionWarning')}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      touchTarget={false}
                      onClick={handlers.autoFixDimensions}
                      className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
                    >
                      {t('binDesigner.tabAutoFix')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Alignment — hidden at width=100% because the control has no
                  visible effect when the tab spans the whole column (#1898).
                  Socket mode is the exception even at 100%: `applySocket`
                  positions the POCKET inside the tab by the same field, and a
                  per-compartment plate override can leave that pocket far
                  narrower than the shelf it sits on. */}
              {(state.isSocketMode ||
                state.label.width < DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH) && (
                <div>
                  <span className="mb-1 flex items-center gap-1 text-xs font-medium text-content-secondary">
                    {t('binDesigner.tabAlignment')}
                    <span title={t('binDesigner.tabAlignmentHint')} className="inline-flex">
                      <InfoIcon size="xs" className="text-content-tertiary" />
                    </span>
                  </span>
                  <div
                    role="group"
                    aria-label={t('binDesigner.tabAlignment')}
                    className={SEGMENT_GROUP_CLASS}
                  >
                    {ALIGNMENT_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        touchTarget={false}
                        onClick={() => handlers.setTabAlignment(option)}
                        aria-pressed={state.label.alignment === option}
                        className={`flex-1 ${getSegmentClass(state.label.alignment === option)}`}
                      >
                        {t(`binDesigner.alignment.${option}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Collapsible>

          <LabelTabShapeControls
            state={state}
            handlers={handlers}
            t={t}
            title={groupTitles.shape}
            summary={dimensionsReadout}
            expanded={expandedGroups.has('shape')}
            onExpandedChange={(open) => setGroupExpanded('shape', open)}
            badge={warningBadge('shape')}
          />

          {/* Engraving styles the printed-in text; irrelevant when the tab
              face carries a socket instead. */}
          {!state.isSocketMode && (
            <LabelTabTextStyleControls
              state={state}
              handlers={handlers}
              t={t}
              title={groupTitles.text}
              summary={textStyleReadout}
              expanded={expandedGroups.has('text')}
              onExpandedChange={(open) => setGroupExpanded('text', open)}
            />
          )}

          <Collapsible
            title={groupTitles.colors}
            expanded={expandedGroups.has('colors')}
            onExpandedChange={(open) => setGroupExpanded('colors', open)}
            size="sm"
          >
            <LabelColorControls />
          </Collapsible>
        </>
      }
    />
  );
}
