/**
 * Click-lock lid section.
 *
 * Wall thickness, top thickness, and fit clearance are intentionally NOT
 * exposed: the click-lock geometry only works with one validated numeric
 * set (see `lidConstants.ts`). The user-facing knobs are stackable top,
 * magnets (gated on stackable top), and per-side click rails.
 */

import { useCallback, useRef } from 'react';
import { FeatureToggle } from '../FeatureToggle';
import { Button } from '@/design-system';
import { Switch } from '@/design-system/Switch';
import { RulerIcon } from '@/design-system/Icon';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { StepperField } from '../shared/StepperField';
import type {
  LidCompatibilityId,
  LidCompatibilityIssue,
} from '@/features/bin-designer/utils/lidCompatibility';
import { LID_RAIL_SIDES, LID_ATTACHMENTS } from '@/features/bin-designer/types';
import type { LidAttachment } from '@/features/bin-designer/types';
import type { useTranslation } from '@/i18n';
import { useLidSection } from './useLidSection';

type Translator = ReturnType<typeof useTranslation>;

/** Attachment-mode picker as a proper radiogroup with roving tabindex +
 *  arrow-key navigation, mirroring `ThicknessSelector`. */
function AttachmentSelector({
  value,
  onChange,
  t,
}: {
  value: LidAttachment;
  onChange: (mode: LidAttachment) => void;
  t: Translator;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = LID_ATTACHMENTS.indexOf(value);
      let nextIndex: number;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % LID_ATTACHMENTS.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + LID_ATTACHMENTS.length) % LID_ATTACHMENTS.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = LID_ATTACHMENTS.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      onChange(LID_ATTACHMENTS[nextIndex]);
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
    },
    [value, onChange]
  );

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-content-secondary">
        {t('binDesigner.lid.attachment')}
      </span>
      <div
        ref={groupRef}
        className="flex gap-1"
        role="radiogroup"
        aria-label={t('binDesigner.lid.attachment')}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {LID_ATTACHMENTS.map((mode) => {
          const isActive = value === mode;
          return (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              role="radio"
              tabIndex={isActive ? 0 : -1}
              aria-checked={isActive}
              onClick={() => onChange(mode)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                  : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.lid.attachment.${mode}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

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
        <Button
          type="button"
          variant="ghost"
          onClick={() => onFix(issue.id)}
          aria-label={t('binDesigner.lid.compat.fixAriaLabel', { detail: message })}
          className="shrink-0 rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-content-secondary hover:bg-surface-hover"
        >
          {t('binDesigner.lid.compat.fixButton')}
        </Button>
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

      {/* Attachment method (#2694) — how the lid retains onto the bin. One of
          friction / click rails / magnetic; the sub-controls below key off it. */}
      <AttachmentSelector value={state.attachment} onChange={handlers.setAttachment} t={t} />

      {/* Extra lid height (issue #2482) — deepens the lid cavity above the
          bin's lip so contents that stick up out of a short bin (toothpicks,
          skewers) are enclosed when the lid is on. 0 = the standard lid. The
          lip grip + click rails are unchanged; only the wall above the lip
          grows. */}
      <div className="space-y-1">
        <StepperField
          label={t('binDesigner.lid.extraHeight')}
          unit="mm"
          value={state.extraHeightMm}
          onChange={handlers.setExtraHeight}
          onStep={(delta) =>
            handlers.setExtraHeight(state.extraHeightMm + delta * state.extraHeightStep)
          }
          min={state.extraHeightMin}
          max={state.extraHeightMax}
          step={state.extraHeightStep}
          size="md"
          aria-label={t('binDesigner.lid.extraHeightAria')}
          commitMode="deferred"
        />
        <p className="text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.lid.extraHeightHint')}
        </p>
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

      {/* Print the stack grid as a separate glue-on baseplate. Gated on the
          stackable top (the baseplate IS that grid). Lets the lid print
          support-free while the baseplate prints flat in its own orientation. */}
      <Switch
        label={t('binDesigner.lid.separateStackPlate')}
        checked={state.separateStackPlate}
        onChange={handlers.toggleSeparateStackPlate}
        disabled={!state.stackableTop}
      />
      {!state.stackableTop && (
        <p className="-mt-2 ml-1 text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.lid.separateStackPlateRequiresStackable')}
        </p>
      )}
      {state.separateStackPlate && state.stackableTop && (
        <p className="-mt-2 ml-1 text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.lid.separateStackPlateHint')}
        </p>
      )}

      {/* Tray top (#2694) — a shelled recess in the lid's top face so items
          rest on the closed lid without sliding off. Mutually exclusive with a
          stackable top (a stack grid owns that surface). */}
      <Switch
        label={t('binDesigner.lid.tray')}
        checked={state.tray.enabled}
        onChange={handlers.toggleTray}
        disabled={state.stackableTop}
      />
      {state.trayDisabledReason && (
        <p className="-mt-2 ml-1 text-[11px] leading-relaxed text-content-tertiary">
          {state.trayDisabledReason}
        </p>
      )}
      {state.tray.enabled && !state.stackableTop && (
        <div className="ml-1 space-y-2">
          <StepperField
            label={t('binDesigner.lid.trayDepth')}
            unit="mm"
            value={state.tray.depthMm}
            onChange={handlers.setTrayDepth}
            onStep={(delta) => handlers.setTrayDepth(state.tray.depthMm + delta * state.trayStep)}
            min={state.trayDepthMin}
            max={state.trayDepthMax}
            step={state.trayStep}
            size="md"
            aria-label={t('binDesigner.lid.trayDepthAria')}
            commitMode="deferred"
          />
          <StepperField
            label={t('binDesigner.lid.trayWall')}
            unit="mm"
            value={state.tray.wallMm}
            onChange={handlers.setTrayWall}
            onStep={(delta) => handlers.setTrayWall(state.tray.wallMm + delta * state.trayStep)}
            min={state.trayWallMin}
            max={state.trayWallMax}
            step={state.trayStep}
            size="md"
            aria-label={t('binDesigner.lid.trayWallAria')}
            commitMode="deferred"
          />
        </div>
      )}

      {/* Magnetic retention (#2694) — dedicated corner magnets bond the lid to
          the bin. Independent of the bin's base magnets. */}
      {state.attachment === 'magnetic' && (
        <div className="space-y-2">
          <StepperField
            label={t('binDesigner.lid.retentionMagnetDiameter')}
            unit="mm"
            value={state.retentionMagnetDiameter}
            onChange={handlers.setRetentionMagnetDiameter}
            onStep={(delta) =>
              handlers.setRetentionMagnetDiameter(
                state.retentionMagnetDiameter + delta * state.retentionMagnetStep
              )
            }
            min={state.retentionMagnetDiameterMin}
            max={state.retentionMagnetDiameterMax}
            step={state.retentionMagnetStep}
            size="md"
            aria-label={t('binDesigner.lid.retentionMagnetDiameterAria')}
            commitMode="deferred"
          />
          <StepperField
            label={t('binDesigner.lid.retentionMagnetDepth')}
            unit="mm"
            value={state.retentionMagnetDepth}
            onChange={handlers.setRetentionMagnetDepth}
            onStep={(delta) =>
              handlers.setRetentionMagnetDepth(
                state.retentionMagnetDepth + delta * state.retentionMagnetStep
              )
            }
            min={state.retentionMagnetDepthMin}
            max={state.retentionMagnetDepthMax}
            step={state.retentionMagnetStep}
            size="md"
            aria-label={t('binDesigner.lid.retentionMagnetDepthAria')}
            commitMode="deferred"
          />
          <p className="ml-1 text-[11px] leading-relaxed text-content-tertiary">
            {t('binDesigner.lid.retentionMagnetHint', {
              diameter: state.retentionMagnetDiameter.toFixed(1),
              depth: state.retentionMagnetDepth.toFixed(1),
            })}
          </p>
        </div>
      )}

      {/* Click rails — per-side. Each chip is an independent toggle: a
          user can ship a hinge-feel lid (one side only), a label-tab-
          friendly L+R pair, or all four for symmetric snap. All four off
          ⇒ friction-fit lid (mating cavity still wraps the lip; no
          positive snap). When a feature conflict disables a side (label
          tab on back, wall cutout/handle on a given side) the chip is
          greyed out with a tooltip — the user's persisted intent is
          kept so the rail returns when the conflict is resolved. Only shown
          in click-rails attachment mode. */}
      {state.attachment === 'clickRails' && (
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
                <Button
                  key={side}
                  type="button"
                  variant="ghost"
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
      )}

      {state.attachment === 'clickRails' && state.anyRail && (
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
