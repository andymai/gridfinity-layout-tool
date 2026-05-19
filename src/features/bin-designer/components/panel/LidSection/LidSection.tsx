/**
 * Click-lock lid section.
 *
 * Wall thickness, top thickness, and fit clearance are intentionally NOT
 * exposed: the click-lock geometry only works with one validated numeric
 * set (see `lidConstants.ts`). The user-facing knobs are stackable top,
 * magnets (gated on stackable top), and per-side click rails.
 */

import { FeatureToggle } from '../FeatureToggle';
import { Switch } from '@/design-system/Switch';
import { RulerIcon } from '@/design-system/Icon';
import { SnappingSlider } from '../../controls/SnappingSlider';
import type {
  LidCompatibilityId,
  LidCompatibilityIssue,
} from '@/features/bin-designer/utils/lidCompatibility';
import { LID_RAIL_SIDES } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { useLidSection } from './useLidSection';

type Translator = ReturnType<typeof useTranslation>;

/** Render a single compatibility issue as a colored bullet line with an
 *  optional one-click Fix button. The button is only shown for issues
 *  whose ID appears in `fixableIds` — issues like `shortBin` or
 *  `cellMaskHoles` need user judgment and don't get an automatic fix. */
function CompatibilityIssue({
  issue,
  fixable,
  onFix,
  t,
}: {
  issue: LidCompatibilityIssue;
  fixable: boolean;
  onFix: (id: LidCompatibilityId) => void;
  t: Translator;
}) {
  // Side IDs ('front'/'back'/'left'/'right') are internal — translate
  // each through `binDesigner.lid.side.*` before joining so non-English
  // locales don't render raw English tokens in the warning text.
  const sides = issue.sides
    ? issue.sides.map((s) => t(`binDesigner.lid.side.${s}`)).join(', ')
    : '';
  const message = t(`binDesigner.lid.compat.${issue.id}`, { sides });
  // Blockers are rendered with the danger token (red); warnings are
  // amber. Both use a small filled dot so the row reads as a list
  // item rather than body copy.
  const isBlocker = issue.severity === 'blocker';
  const dotColor = isBlocker ? 'bg-danger' : 'bg-warning';
  const textColor = isBlocker ? 'text-danger' : 'text-warning';
  return (
    <li className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${textColor}`}>
      <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${dotColor}`} />
      <span className="flex-1">{message}</span>
      {fixable && (
        <button
          type="button"
          onClick={() => onFix(issue.id)}
          aria-label={t('binDesigner.lid.compat.fixAriaLabel', { detail: message })}
          className="shrink-0 rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-content-secondary hover:bg-surface-hover"
        >
          {t('binDesigner.lid.compat.fixButton')}
        </button>
      )}
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
              <CompatibilityIssue
                key={issue.id}
                issue={issue}
                fixable={state.fixableIds.has(issue.id)}
                onFix={handlers.fixIssue}
                t={t}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Live physical readout — grounds the params in real-world mm so
          users can sanity-check before printing. Wall thickness / top
          thickness used to live next to this but they're now fixed. */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">{state.dimensionsReadout}</span>
      </div>

      {/* Switches for the orthogonal toggles. Magnet pockets only do
          something when there's a stack grid above them (a bin stacked
          ON the lid mates with the pockets through the floor) — gate
          accordingly. */}
      <Switch
        label={t('binDesigner.lid.stackableTop')}
        checked={state.stackableTop}
        onChange={handlers.toggleStackableTop}
      />
      <Switch
        label={t('binDesigner.lid.magnetHoles')}
        checked={state.magnetHoles}
        onChange={handlers.toggleMagnetHoles}
        disabled={!state.stackableTop}
      />
      {state.magnetsDisabledReason && (
        <p className="-mt-2 ml-1 text-[11px] leading-relaxed text-content-tertiary">
          {state.magnetsDisabledReason}
        </p>
      )}
      {state.magnetHoles && state.stackableTop && (
        <p className="-mt-2 ml-1 text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.lid.magnetSpec', {
            diameter: state.magnetDiameter.toFixed(1),
            depth: state.magnetDepth.toFixed(1),
          })}
        </p>
      )}

      {/* Click rails — per-side. Each chip is an independent toggle: a
          user can ship a hinge-feel lid (one side only), a label-tab-
          friendly L+R pair, or all four for symmetric snap. All four off
          ⇒ friction-fit lid (mating cavity still wraps the lip; no
          positive snap). When a feature conflict disables a side (label
          tab on back, wall cutout/handle on a given side) the chip is
          greyed out with a tooltip — the user's persisted intent is
          kept so the rail returns when the conflict is resolved. */}
      <div>
        <span className="mb-1 block text-xs font-medium text-content-secondary">
          {t('binDesigner.lid.clickRails')}
        </span>
        <div className="flex gap-1">
          {LID_RAIL_SIDES.map((side) => {
            const isActive = state.clickRails[side];
            const isAutoDisabled = state.disabledRails.has(side);
            const effectiveActive = isActive && !isAutoDisabled;
            const tooltip = isAutoDisabled
              ? t('binDesigner.lid.clickRailDisabledBySide', {
                  side: t(`binDesigner.lid.side.${side}`),
                })
              : undefined;
            return (
              <button
                key={side}
                type="button"
                role="switch"
                aria-checked={effectiveActive}
                aria-disabled={isAutoDisabled}
                disabled={isAutoDisabled}
                title={tooltip}
                onClick={() => handlers.toggleClickRailSide(side)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  isAutoDisabled
                    ? 'cursor-not-allowed border border-stroke-subtle bg-surface-secondary text-content-tertiary line-through opacity-60'
                    : effectiveActive
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
