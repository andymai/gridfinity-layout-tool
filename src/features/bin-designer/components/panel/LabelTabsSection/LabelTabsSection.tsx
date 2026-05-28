/**
 * Label tabs section: configurable shelf tabs on the back wall of each compartment.
 *
 * All controls are visible immediately when the feature is toggled on:
 * style picker, width, depth, and alignment.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { Input, Select, InfoIcon } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { RulerIcon } from '@/design-system/Icon';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { TEXT_MAX_LENGTH } from '../../../types';
import type {
  LabelTabAlignment,
  LabelTabEdges,
  LabelTabSupport,
  TextFontFamily,
  TextMode,
} from '../../../types';
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

  return (
    <FeatureToggle
      label={t('binDesigner.labelTabs')}
      checked={state.label.enabled}
      onChange={handlers.toggleLabelTabs}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Edges picker — the most fundamental choice (1 tab vs 2) and the entry
          point for the tuck-under-ledge use case (#1898). */}
      <div>
        <span className="text-xs font-medium text-content-secondary mb-1 block">
          {t('binDesigner.tabEdges')}
        </span>
        <div role="group" aria-label={t('binDesigner.tabEdges')} className="flex gap-1">
          {EDGES_OPTIONS.map((option) => {
            const current = state.label.edges ?? 'back';
            return (
              <button
                key={option}
                type="button"
                onClick={() => handlers.setTabEdges(option)}
                aria-pressed={current === option}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  current === option
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                }`}
              >
                {t(`binDesigner.tabEdges.${option}`)}
              </button>
            );
          })}
        </div>
        {state.tabsWillSilentlyDrop && (
          <div className="mt-1 flex items-start gap-2 text-xs text-warning">
            <InfoIcon size="xs" className="mt-0.5 shrink-0" />
            <span className="flex-1">{t('binDesigner.tabBothCollisionWarning')}</span>
            <button
              type="button"
              onClick={handlers.autoFixDimensions}
              className="shrink-0 font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {t('binDesigner.tabAutoFix')}
            </button>
          </div>
        )}
      </div>

      {/* Width × Depth / Height × Inset — 2×2 grid keeps four steppers
          readable on narrow viewports. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.tabWidth')}
          </span>
          <StepperControl
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
            variant="desktop"
            ariaLabel={t('binDesigner.labelTabs.widthAria')}
          />
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.tabDepth')}
          </span>
          <StepperControl
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
            variant="desktop"
            ariaLabel={t('binDesigner.labelTabs.depthAria')}
          />
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.tabHeight')}
          </span>
          <StepperControl
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
            variant="desktop"
            ariaLabel={t('binDesigner.labelTabs.heightAria')}
          />
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.tabInset')}
          </span>
          <StepperControl
            value={state.label.inset ?? 0}
            onChange={handlers.setTabInset}
            onStep={(delta) =>
              handlers.setTabInset(
                Math.min(
                  state.tabInsetMax,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET,
                    (state.label.inset ?? 0) + delta * DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET}
            max={state.tabInsetMax}
            step={DESIGNER_CONSTRAINTS.LABEL_TAB_INSET_STEP}
            variant="desktop"
            ariaLabel={t('binDesigner.labelTabs.insetAria')}
          />
        </div>
      </div>

      {/* Physical tab dimensions — only show H when explicitly set, so unaltered designs stay visually unchanged */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">
          {state.tabWidthMm} × {state.label.depth}
          {state.heightIsExplicit ? ` × ${state.tabHeightMm}` : ''} mm
        </span>
      </div>

      {/* Alignment — hidden when width=100% because the control has no visible
          effect at full width (the tab spans the whole compartment column).
          Showing an inert control was the root cause of #1898's UX confusion. */}
      {state.label.width < DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH && (
        <div>
          <span className="text-xs font-medium text-content-secondary mb-1 flex items-center gap-1">
            {t('binDesigner.tabAlignment')}
            <span title={t('binDesigner.tabAlignmentHint')} className="inline-flex">
              <InfoIcon size="xs" className="text-content-tertiary" />
            </span>
          </span>
          <div role="group" aria-label={t('binDesigner.tabAlignment')} className="flex gap-1">
            {ALIGNMENT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handlers.setTabAlignment(option)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  state.label.alignment === option
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                }`}
              >
                {t(`binDesigner.alignment.${option}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Support picker — `<span>` heading; segmented control gets the group label */}
      <div>
        <span className="text-xs font-medium text-content-secondary mb-1 block">
          {t('binDesigner.tabSupport')}
        </span>
        <div role="group" aria-label={t('binDesigner.tabSupport')} className="flex gap-1">
          {SUPPORT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handlers.setTabSupport(option)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                state.label.support === option
                  ? 'bg-accent text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.tabSupport.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Engraved-text group — settings on top, per-compartment inputs below.
          The `<span>` heading isn't a `<label>` because there's no single
          input to associate via htmlFor. */}
      <div className="flex flex-col gap-2 border-t border-stroke-subtle pt-3">
        <span className="text-xs font-medium text-content-secondary block">
          {t('binDesigner.tabEngravedText')}
        </span>

        {/* Design-level text style: mode, font, depth */}
        <div className="flex flex-col gap-2 rounded-md border border-stroke-subtle bg-surface-elevated p-2">
          {/* Mode picker — segmented control, mirroring the alignment/support pattern */}
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.textMode')}
            </span>
            <div role="group" aria-label={t('binDesigner.textMode')} className="flex gap-1">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handlers.setTextMode(option)}
                  aria-pressed={state.textDefaults.mode === option}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    state.textDefaults.mode === option
                      ? 'bg-accent text-on-accent'
                      : 'border border-stroke-subtle bg-surface text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(`binDesigner.textMode.${option}`)}
                </button>
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
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.textFont')}
              </span>
              <Select
                size="sm"
                fullWidth
                // In through-cut mode the renderer forces Allerta Stencil
                // regardless of preference — show that as the displayed value
                // so the disabled state isn't misleading. The user's font
                // preference is preserved in `textDefaults.font` and restored
                // when they switch back to engrave or emboss.
                value={
                  state.textDefaults.mode === 'through-cut'
                    ? 'allerta-stencil'
                    : state.textDefaults.font
                }
                onChange={(e) => handlers.setTextFont(e.target.value as TextFontFamily)}
                disabled={state.textDefaults.mode === 'through-cut'}
                aria-label={t('binDesigner.textFont')}
                options={FONT_OPTIONS.map(
                  (f): SelectOption => ({
                    id: f,
                    name: t(`binDesigner.textFont.${f}`),
                  })
                )}
              />
            </div>
            {state.textDefaults.mode !== 'through-cut' && (
              <div className="flex-1 min-w-0">
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.textDepth')}
                </span>
                <StepperControl
                  value={state.textDefaults.depth}
                  onChange={handlers.setTextDepth}
                  onStep={(delta) =>
                    handlers.setTextDepth(
                      Math.min(
                        TEXT_DEPTH_MAX,
                        Math.max(TEXT_DEPTH_MIN, state.textDefaults.depth + delta * TEXT_DEPTH_STEP)
                      )
                    )
                  }
                  min={TEXT_DEPTH_MIN}
                  max={TEXT_DEPTH_MAX}
                  step={TEXT_DEPTH_STEP}
                  variant="desktop"
                  ariaLabel={t('binDesigner.textDepth')}
                />
              </div>
            )}
          </div>
        </div>

        {/* Per-compartment text inputs */}
        <ul className="flex flex-col gap-1.5">
          {state.compartmentTextRows.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-content-tertiary tabular-nums">
                {row.label}
              </span>
              <Input
                type="text"
                size="sm"
                value={row.value}
                maxLength={TEXT_MAX_LENGTH}
                onChange={(e) => handlers.setCompartmentText(row.id, e.target.value)}
                placeholder={t('binDesigner.tabEngravedTextPlaceholder')}
                aria-label={t('binDesigner.tabEngravedTextAriaLabel', { n: row.displayNumber })}
              />
            </li>
          ))}
        </ul>
      </div>
    </FeatureToggle>
  );
}
