/**
 * Click-lock lid section.
 *
 * Composed layout (matches HandleSection): the Fit picker lives in
 * `primaryControls` so it's always visible while the lid is on; the
 * customize area carries the secondary controls plus a live mm readout
 * grounding the percentages in real geometry.
 */

import { FeatureToggle } from '../FeatureToggle';
import { Switch } from '@/design-system/Switch';
import { RulerIcon } from '@/design-system/Icon';
import { SnappingSlider } from '../../controls/SnappingSlider';
import type { LidCompatibilityIssue } from '@/features/bin-designer/utils/lidCompatibility';
import { LID_RAIL_SIDES } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { useLidSection, FIT_OPTIONS } from './useLidSection';

type Translator = ReturnType<typeof useTranslation>;

/** Render a single compatibility issue as a colored bullet line. */
function CompatibilityIssue({ issue, t }: { issue: LidCompatibilityIssue; t: Translator }) {
  const sides = issue.sides ? issue.sides.join(', ') : '';
  const message = t(`binDesigner.lid.compat.${issue.id}`, { sides });
  // Blockers are rendered with the danger token (red); warnings are
  // amber. Both use a small filled dot so the row reads as a list
  // item rather than body copy.
  const isBlocker = issue.severity === 'blocker';
  const dotColor = isBlocker ? 'bg-danger' : 'bg-warning';
  const textColor = isBlocker ? 'text-danger' : 'text-warning';
  return (
    <li className={`flex gap-1.5 text-[11px] leading-relaxed ${textColor}`}>
      <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${dotColor}`} />
      <span>{message}</span>
    </li>
  );
}

export function LidSection() {
  const { state, handlers, t } = useLidSection();

  return (
    <FeatureToggle
      label={t('binDesigner.lid')}
      checked={state.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={state.disabledReason}
      valueSummary={state.valueSummary}
      badge={
        <span className="rounded bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning">
          {t('settings.experimental')}
        </span>
      }
      primaryControls={
        // Fit is the most consequential lid choice — keep it always visible
        // when the lid is on, before the "Customize" gate. Mirrors
        // HandleSection's shape selector + side chips pattern.
        <div className="flex gap-1">
          {FIT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handlers.setFit(option)}
              aria-pressed={state.fit === option}
              className={`flex-1 rounded px-3 py-2 text-xs font-medium transition-colors min-h-[36px] ${
                state.fit === option
                  ? 'bg-accent text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.fit.${option}`)}
            </button>
          ))}
        </div>
      }
    >
      {/* Print-time hint — the mating cavity and click rails are
          downward-facing overhangs that need supports for a clean print. */}
      <p className="text-[11px] leading-relaxed text-content-tertiary">
        {t('binDesigner.lid.printNote')}
      </p>

      {/* Compatibility notes — features that conflict with click-lock
          mating. Only renders when there are issues; blockers and
          warnings share the list and are color-coded by severity. */}
      {state.compatibilityIssues.length > 0 && (
        <div className="space-y-1 rounded-md border border-stroke-subtle bg-surface-secondary px-2.5 py-2">
          <p className="text-[11px] font-medium text-content-secondary">
            {t('binDesigner.lid.compat.heading')}
          </p>
          <ul className="space-y-1">
            {state.compatibilityIssues.map((issue) => (
              <CompatibilityIssue key={issue.id} issue={issue} t={t} />
            ))}
          </ul>
        </div>
      )}

      {/* Wall + Top thickness paired side-by-side (LabelTabsSection pattern). */}
      <div className="grid grid-cols-2 gap-3">
        <SnappingSlider
          label={t('binDesigner.lid.wallThickness')}
          value={state.wallThickness}
          onChange={handlers.setWallThickness}
          options={state.thicknessOptions}
        />
        <SnappingSlider
          label={t('binDesigner.lid.topThickness')}
          value={state.topThickness}
          onChange={handlers.setTopThickness}
          options={state.thicknessOptions}
        />
      </div>

      {/* Live physical readout — grounds the params in real-world mm so
          users can sanity-check before printing. Matches LabelTabsSection
          and HandleSection conventions. */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">{state.dimensionsReadout}</span>
      </div>

      {/* Switches for the orthogonal toggles. */}
      <Switch
        label={t('binDesigner.lid.stackableTop')}
        checked={state.stackableTop}
        onChange={handlers.toggleStackableTop}
      />
      <Switch
        label={t('binDesigner.lid.magnetHoles')}
        checked={state.magnetHoles}
        onChange={handlers.toggleMagnetHoles}
      />

      {/* Click rails — per-side. Each chip is an independent toggle: a
          user can ship a hinge-feel lid (one side only), a label-tab-
          friendly L+R pair, or all four for symmetric snap. All four off
          ⇒ friction-fit lid (mating cavity still wraps the lip; no
          positive snap). Mirrors HandleSection's side-chip pattern. */}
      <div>
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.clickRails')}
        </span>
        <div className="flex gap-1">
          {LID_RAIL_SIDES.map((side) => {
            const isActive = state.clickRails[side];
            return (
              <button
                key={side}
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => handlers.toggleClickRailSide(side)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                }`}
              >
                {t(`binDesigner.lid.side.${side}`)}
              </button>
            );
          })}
        </div>
      </div>

      {state.anyRail && (
        <div className="space-y-1">
          <SnappingSlider
            label={t('binDesigner.lid.clickRailCoverage')}
            value={state.clickRailCoverage}
            onChange={handlers.setClickRailCoverage}
            options={state.railCoverageOptions}
            unit="%"
          />
          <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
            <RulerIcon size="xs" />
            <span className="tabular-nums">{state.railsReadout}</span>
          </div>
        </div>
      )}
    </FeatureToggle>
  );
}
