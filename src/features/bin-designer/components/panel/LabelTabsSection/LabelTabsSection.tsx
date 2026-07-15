/**
 * Label tabs section.
 *
 * When enabled, the panel leads with the content (the per-compartment label
 * list) and the one common setting (edges). Advanced geometry and text styling
 * fold into collapsed "Tab shape & size" and "Engraving" groups so the default
 * view stays calm.
 */

import { useState } from 'react';
import { FeatureToggle } from '../FeatureToggle';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import {
  Button,
  Select,
  Stepper,
  InfoIcon,
  Badge,
  ChevronDownIcon,
  Collapsible,
} from '@/design-system';
import { LabelSizeControl } from '../../controls';
import type { SelectOption } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import type {
  LabelTabAlignment,
  LabelTabEdges,
  LabelTabSupport,
  TextFontFamily,
  TextMode,
} from '../../../types';
import { CompartmentTextInput } from './CompartmentTextInput';
import { LabelColorControls } from './LabelColorControls';
import { useLabelTabsSection } from './useLabelTabsSection';

const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const SUPPORT_OPTIONS: LabelTabSupport[] = ['bracket', 'solid', 'fillet'];
const EDGES_OPTIONS: LabelTabEdges[] = ['back', 'front', 'both'];
const MODE_OPTIONS: TextMode[] = ['engrave', 'emboss', 'through-cut'];

const FONT_OPTIONS: readonly TextFontFamily[] = [
  'atkinson',
  'jetbrains-mono',
  'allerta-stencil',
] as const;

/** Per-mode bounds for the engrave/emboss depth stepper. Through-cut ignores
 *  `depth` (cuts through the full shelf), so the picker is hidden in that
 *  mode rather than disabled. */
const TEXT_DEPTH_MIN = 0.2;
const TEXT_DEPTH_MAX = 5;
const TEXT_DEPTH_STEP = 0.1;

export function LabelTabsSection() {
  const { state, handlers, meta, t } = useLabelTabsSection();
  const [labelsOpen, setLabelsOpen] = useState(false);

  const dimensionsReadout = `${state.tabWidthMm} × ${state.label.depth}${
    state.heightIsExplicit ? ` × ${state.tabHeightMm}` : ''
  } mm`;

  // Bulk list goes in `primaryControls`, not a Customize child: the Customize
  // area is clipped at a fixed max-height/overflow-hidden, so a long list (up to
  // 144 rows) would be cut off. As a primary control it flows full-height under
  // the panel's own scrollbar.
  const compartmentLabels =
    state.compartmentTextRows.length > 0 ? (
      <div>
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          onClick={() => setLabelsOpen((open) => !open)}
          aria-expanded={labelsOpen}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-stroke-subtle bg-surface px-2.5 py-2 text-xs font-medium text-content hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            {t('binDesigner.compartmentLabelsList')}
            <Badge>{state.compartmentTextRows.length}</Badge>
          </span>
          <ChevronDownIcon
            size="xs"
            className={`text-content-tertiary transition-transform duration-200 ${
              labelsOpen ? 'rotate-0' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
        </Button>
        {labelsOpen && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {state.compartmentTextRows.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-content-tertiary tabular-nums">
                  {row.label}
                </span>
                <CompartmentTextInput
                  committedValue={row.value}
                  compartmentId={row.id}
                  onCommit={handlers.setCompartmentText}
                  placeholder={t('binDesigner.tabEngravedTextPlaceholder')}
                  ariaLabel={t('binDesigner.tabEngravedTextAriaLabel', { n: row.displayNumber })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <FeatureToggle
      label={t('binDesigner.labelTabs')}
      checked={state.label.enabled}
      onChange={handlers.toggleLabelTabs}
      disabledReason={meta.disabledReason}
      primaryControls={
        <>
          {compartmentLabels}

          {/* Edges — the most fundamental choice (1 tab vs 2) and the entry
              point for the tuck-under-ledge use case (#1898); kept primary.
              The silent-drop warning + auto-fix live here since they're about
              edges colliding with the (collapsed) dimensions. */}
          <div>
            <span className="mb-1 block text-xs font-medium text-content-secondary">
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

          <LabelColorControls />

          <Collapsible title={t('binDesigner.tabShapeGroup')} defaultExpanded={false} size="sm">
            <div className="space-y-3">
              {/* Support */}
              <div>
                <span className="mb-1 block text-xs font-medium text-content-secondary">
                  {t('binDesigner.tabSupport')}
                </span>
                <div
                  role="group"
                  aria-label={t('binDesigner.tabSupport')}
                  className={SEGMENT_GROUP_CLASS}
                >
                  {SUPPORT_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="ghost"
                      touchTarget={false}
                      onClick={() => handlers.setTabSupport(option)}
                      aria-pressed={state.label.support === option}
                      className={`flex-1 ${getSegmentClass(state.label.support === option)}`}
                    >
                      {t(`binDesigner.tabSupport.${option}`)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Alignment — hidden at width=100% because the control has no
                  visible effect when the tab spans the whole column (#1898). */}
              {state.label.width < DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH && (
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

              {/* Dimensions — defaults suit most prints, so the four steppers
                  collapse with the mm readout as the summary. */}
              <Collapsible
                title={t('binDesigner.tabDimensionsGroup')}
                summary={dimensionsReadout}
                defaultExpanded={false}
                size="sm"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs text-content-tertiary">
                      {t('binDesigner.tabWidth')}
                    </span>
                    <Stepper
                      value={state.label.width}
                      onChange={handlers.setTabWidth}
                      onStep={(delta) =>
                        handlers.setTabWidth(
                          Math.min(
                            DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
                            Math.max(
                              DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
                              state.label.width + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_WIDTH_STEP
                            )
                          )
                        )
                      }
                      min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH}
                      max={DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH}
                      step={DESIGNER_CONSTRAINTS.LABEL_TAB_WIDTH_STEP}
                      size="md"
                      aria-label={t('binDesigner.labelTabs.widthAria')}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs text-content-tertiary">
                      {t('binDesigner.tabDepth')}
                    </span>
                    <Stepper
                      value={state.label.depth}
                      onChange={handlers.setTabDepth}
                      onStep={(delta) =>
                        handlers.setTabDepth(
                          Math.min(
                            state.tabDepthMax,
                            Math.max(
                              DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
                              state.label.depth + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP
                            )
                          )
                        )
                      }
                      min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH}
                      max={state.tabDepthMax}
                      step={DESIGNER_CONSTRAINTS.LABEL_TAB_DEPTH_STEP}
                      size="md"
                      aria-label={t('binDesigner.labelTabs.depthAria')}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs text-content-tertiary">
                      {t('binDesigner.tabHeight')}
                    </span>
                    <Stepper
                      value={state.tabHeightMm}
                      onChange={handlers.setTabHeight}
                      onStep={(delta) =>
                        handlers.setTabHeight(
                          Math.min(
                            state.tabHeightMax,
                            Math.max(
                              state.tabHeightMin,
                              state.tabHeightMm + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_HEIGHT_STEP
                            )
                          )
                        )
                      }
                      min={state.tabHeightMin}
                      max={state.tabHeightMax}
                      step={DESIGNER_CONSTRAINTS.LABEL_TAB_HEIGHT_STEP}
                      size="md"
                      aria-label={t('binDesigner.labelTabs.heightAria')}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs text-content-tertiary">
                      {t('binDesigner.tabInset')}
                    </span>
                    <Stepper
                      value={state.label.inset ?? 0}
                      onChange={handlers.setTabInset}
                      onStep={(delta) =>
                        handlers.setTabInset(
                          Math.min(
                            state.tabInsetMax,
                            Math.max(
                              DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET,
                              (state.label.inset ?? 0) +
                                delta * DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP
                            )
                          )
                        )
                      }
                      min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET}
                      max={state.tabInsetMax}
                      step={DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP}
                      size="md"
                      aria-label={t('binDesigner.labelTabs.insetAria')}
                    />
                  </div>
                </div>
              </Collapsible>
            </div>
          </Collapsible>

          <Collapsible title={t('binDesigner.tabEngravedText')} defaultExpanded={false} size="sm">
            <div className="space-y-2">
              {/* Mode picker */}
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.textMode')}
                </span>
                <div
                  role="group"
                  aria-label={t('binDesigner.textMode')}
                  className={SEGMENT_GROUP_CLASS}
                >
                  {MODE_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="ghost"
                      touchTarget={false}
                      onClick={() => handlers.setTextMode(option)}
                      aria-pressed={state.textDefaults.mode === option}
                      className={`flex-1 ${getSegmentClass(state.textDefaults.mode === option)}`}
                    >
                      {t(`binDesigner.textMode.${option}`)}
                    </Button>
                  ))}
                </div>
                {state.textDefaults.mode === 'through-cut' && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-content-tertiary">
                    <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                    <span>{t('binDesigner.textMode.throughCutStencilNote')}</span>
                  </p>
                )}
              </div>

              {/* Font + (conditional) depth, side by side when both visible */}
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.textFont')}
                  </span>
                  <Select
                    size="sm"
                    fullWidth
                    // Through-cut forces Allerta Stencil at render time; show
                    // that as the value so the disabled state isn't misleading.
                    // The user's font preference is preserved in
                    // `textDefaults.font` and restored on switching back.
                    value={
                      state.textDefaults.mode === 'through-cut'
                        ? 'allerta-stencil'
                        : state.textDefaults.font
                    }
                    onChange={(e) => handlers.setTextFont(e.target.value as TextFontFamily)}
                    disabled={state.textDefaults.mode === 'through-cut'}
                    aria-label={t('binDesigner.textFont')}
                    options={FONT_OPTIONS.map((f): SelectOption => ({
                      id: f,
                      name: t(`binDesigner.textFont.${f}`),
                    }))}
                  />
                </div>
                {state.textDefaults.mode !== 'through-cut' && (
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs text-content-tertiary">
                      {t('binDesigner.textDepth')}
                    </span>
                    <Stepper
                      value={state.textDefaults.depth}
                      onChange={handlers.setTextDepth}
                      onStep={(delta) =>
                        handlers.setTextDepth(
                          Math.min(
                            TEXT_DEPTH_MAX,
                            Math.max(
                              TEXT_DEPTH_MIN,
                              state.textDefaults.depth + delta * TEXT_DEPTH_STEP
                            )
                          )
                        )
                      }
                      min={TEXT_DEPTH_MIN}
                      max={TEXT_DEPTH_MAX}
                      step={TEXT_DEPTH_STEP}
                      size="md"
                      aria-label={t('binDesigner.textDepth')}
                    />
                  </div>
                )}
              </div>
              <LabelSizeControl
                className="mt-3"
                labelClassName="text-xs text-content-tertiary"
                value={state.label.textStyle?.fontSizeOverride}
                onChange={handlers.setTextSize}
                min={state.textDefaults.minFontSize}
                max={state.textDefaults.maxFontSize}
              />
            </div>
          </Collapsible>
        </>
      }
    />
  );
}
