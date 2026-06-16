/**
 * Wall cutouts section: U-shaped notches from the top of bin walls.
 *
 * Controls: master toggle, shape picker, spatial side selector, linked/independent
 * mode, span/height steppers with %/mm toggle, collapsible position controls
 * (alignment + offset). Shares its selectors, steppers, and disclosure with the
 * handle section via panel/shared so the two panels read identically.
 */

import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import {
  ShapePicker,
  SideSelector,
  StepperField,
  AdvancedDisclosure,
  LinkIcon,
  type SideState,
} from '../shared';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import type {
  WallSide,
  WallCutout,
  WallCutoutShape,
  LabelTabAlignment,
} from '@/features/bin-designer/types';

const SIDE_ORDER: readonly Exclude<WallSide, 'interior'>[] = ['left', 'right', 'front', 'back'];
const ALIGNMENT_OPTIONS: readonly LabelTabAlignment[] = ['left', 'center', 'right'];
const OFFSET_STEP = 1;

const SHAPE_OPTIONS: readonly { value: WallCutoutShape; labelKey: string }[] = [
  { value: 'u-shape', labelKey: 'binDesigner.wallCutouts.shape.uShape' },
  { value: 'scoop', labelKey: 'binDesigner.wallCutouts.shape.scoop' },
  { value: 'funnel', labelKey: 'binDesigner.wallCutouts.shape.funnel' },
];

/** Whether a cutout has non-default positioning (worth auto-expanding to show). */
function hasCustomPosition(cfg: WallCutout): boolean {
  return cfg.alignment !== 'center' || cfg.offset !== 0;
}

/** Span + height steppers on one row, with a %/mm unit toggle on the span. */
function SizeControls({
  side,
  cfg,
  hideDepth,
  handlers,
  spanLabel,
  heightLabel,
  step,
}: {
  side: WallSide;
  cfg: WallCutout;
  hideDepth: boolean;
  handlers: ReturnType<typeof useWallCutoutsSection>['handlers'];
  spanLabel: string;
  heightLabel: string;
  step: number;
}) {
  const t = useTranslation();
  const widthMm = cfg.widthMm ?? 1;
  const isMmMode = cfg.widthMm !== null;

  return (
    <div className="flex items-end gap-2">
      {isMmMode ? (
        <StepperField
          label={spanLabel}
          unit="mm"
          value={widthMm}
          onChange={(v) => handlers.setSideWidthMm(side, Math.max(1, v))}
          onStep={(delta) => handlers.setSideWidthMm(side, Math.max(1, widthMm + delta))}
          min={1}
          max={500}
          step={1}
          size="md"
          aria-label={t('binDesigner.wallCutouts.spanMmAria')}
          commitMode="deferred"
        />
      ) : (
        <StepperField
          label={spanLabel}
          unit="%"
          value={cfg.width}
          onChange={(v) => handlers.setSideWidth(side, v)}
          onStep={(delta) =>
            handlers.setSideWidth(side, Math.max(0, Math.min(100, cfg.width + delta * step)))
          }
          min={0}
          max={100}
          step={step}
          size="md"
          aria-label={t('binDesigner.wallCutouts.spanPercentAria')}
          commitMode="deferred"
        />
      )}

      {/* %/mm unit toggle for the span */}
      <Button
        type="button"
        variant="secondary"
        onClick={() => handlers.setSideWidthMm(side, isMmMode ? null : 30)}
        className="shrink-0 rounded-md border border-stroke-subtle bg-surface-elevated px-1.5 py-1 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-hover"
      >
        {isMmMode ? 'mm' : '%'}
      </Button>

      {!hideDepth && (
        <StepperField
          label={heightLabel}
          unit="%"
          value={cfg.depth}
          onChange={(v) => handlers.setSideDepth(side, v)}
          onStep={(delta) =>
            handlers.setSideDepth(side, Math.max(0, Math.min(100, cfg.depth + delta * step)))
          }
          min={0}
          max={100}
          step={step}
          size="md"
          aria-label={t('binDesigner.wallCutouts.heightPercentAria')}
          commitMode="deferred"
        />
      )}
    </div>
  );
}

/** Collapsible alignment + offset controls. Auto-expands when non-default. */
function PositionDisclosure({
  side,
  cfg,
  handlers,
  t,
}: {
  side: WallSide;
  cfg: WallCutout;
  handlers: ReturnType<typeof useWallCutoutsSection>['handlers'];
  t: (key: string) => string;
}) {
  const isCustom = hasCustomPosition(cfg);
  const alignmentLabel = t(`binDesigner.alignment.${cfg.alignment}`);
  const summary = isCustom
    ? `${alignmentLabel}${cfg.offset !== 0 ? ` ${cfg.offset > 0 ? '+' : ''}${cfg.offset}mm` : ''}`
    : alignmentLabel;

  return (
    <AdvancedDisclosure
      label={`${t('binDesigner.wallCutouts.position')}:`}
      summary={summary}
      forceOpen={isCustom}
    >
      <ShapePicker
        options={ALIGNMENT_OPTIONS.map((value) => ({
          value,
          label: t(`binDesigner.alignment.${value}`),
        }))}
        value={cfg.alignment}
        onChange={(value) => handlers.setSideAlignment(side, value)}
        ariaLabel={t('binDesigner.wallCutouts.position')}
      />

      {(cfg.alignment !== 'center' || cfg.offset !== 0) && (
        <div className="flex">
          <StepperField
            label={t('binDesigner.wallCutouts.offset')}
            unit="mm"
            value={cfg.offset}
            onChange={(v) => handlers.setSideOffset(side, v)}
            onStep={(delta) => handlers.setSideOffset(side, cfg.offset + delta * OFFSET_STEP)}
            min={-50}
            max={50}
            step={OFFSET_STEP}
            size="md"
            aria-label={t('binDesigner.wallCutouts.offsetMmAria')}
            commitMode="deferred"
          />
        </div>
      )}
    </AdvancedDisclosure>
  );
}

export function WallCutoutsSection() {
  const { state, handlers, meta, t, STEP } = useWallCutoutsSection();
  const { walls, activeSides, linked, blocksLid, showDensityHint } = state;

  const sharedSide = activeSides.length > 0 ? activeSides[0] : undefined;
  const hideDepth = walls.shape === 'scoop';

  const sideStates: SideState[] = SIDE_ORDER.map((side) => ({
    side,
    label: t(`binDesigner.wallCutouts.${side}`),
    active: walls[side].enabled,
  }));

  return (
    <FeatureToggle
      label={t('binDesigner.wallCutouts')}
      checked={walls.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      badge={
        // Small red dot when this section is currently blocking the
        // click-lock lid. Only renders when lid is enabled AND all 4
        // walls have cutouts (the only wall-cutout config that fully
        // removes the lip).
        blocksLid ? (
          <span
            role="img"
            aria-label={t('binDesigner.lid.conflictBadgeLabel')}
            title={t('binDesigner.lid.conflictBadgeLabel')}
            className="inline-block h-1.5 w-1.5 rounded-full bg-danger"
          />
        ) : undefined
      }
      primaryControls={
        <div className="space-y-3">
          {/* Shape picker */}
          <ShapePicker
            options={SHAPE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            value={walls.shape}
            onChange={handlers.setShape}
            ariaLabel={t('binDesigner.wallCutouts')}
          />

          {/* Spatial side selector */}
          <SideSelector
            sides={sideStates}
            onToggle={(side) => handlers.toggleSide(side)}
            ariaLabel={t('binDesigner.wallCutouts')}
          />

          {/* Controls — shown when at least one side is active */}
          {activeSides.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlers.toggleLinked}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    linked
                      ? 'bg-accent/10 text-accent hover:bg-accent/10 hover:text-accent'
                      : 'bg-surface-secondary text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  <LinkIcon linked={linked} />
                  {linked
                    ? t('binDesigner.wallCutouts.linked')
                    : t('binDesigner.wallCutouts.independent')}
                </Button>
              </div>

              {/* Shared controls (linked mode) */}
              {linked && sharedSide && (
                <>
                  <SizeControls
                    side={sharedSide}
                    cfg={walls[sharedSide]}
                    hideDepth={hideDepth}
                    handlers={handlers}
                    spanLabel={t('binDesigner.wallCutouts.span')}
                    heightLabel={t('binDesigner.wallCutouts.height')}
                    step={STEP}
                  />
                  <PositionDisclosure
                    side={sharedSide}
                    cfg={walls[sharedSide]}
                    handlers={handlers}
                    t={t}
                  />
                </>
              )}

              {/* Per-side controls (independent mode) */}
              {!linked &&
                SIDE_ORDER.filter((side) => walls[side].enabled).map((side) => (
                  <div key={side} className="space-y-2">
                    <label className="block text-xs font-medium text-content-secondary">
                      {t(`binDesigner.wallCutouts.${side}`)}
                    </label>
                    <SizeControls
                      side={side}
                      cfg={walls[side]}
                      hideDepth={hideDepth}
                      handlers={handlers}
                      spanLabel={t('binDesigner.wallCutouts.span')}
                      heightLabel={t('binDesigner.wallCutouts.height')}
                      step={STEP}
                    />
                    <PositionDisclosure side={side} cfg={walls[side]} handlers={handlers} t={t} />
                  </div>
                ))}
            </>
          )}

          {/* Density expectation hint (issue #1882) — contextual */}
          {showDensityHint && (
            <p className="text-xs leading-snug text-content-tertiary">
              {t('binDesigner.wallCutouts.densityHint')}
            </p>
          )}

          {/* Interior walls */}
          <div className="border-t border-stroke-subtle/50 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-content-secondary">
              <input
                type="checkbox"
                checked={walls.interior.enabled}
                onChange={() => handlers.toggleSide('interior')}
                className="h-3.5 w-3.5 rounded border-stroke-subtle text-accent focus:ring-accent"
              />
              {t('binDesigner.wallCutouts.interior')}
            </label>
            {walls.interior.enabled && !linked && (
              <div className="ml-6 mt-2">
                <SizeControls
                  side="interior"
                  cfg={walls.interior}
                  hideDepth={hideDepth}
                  handlers={handlers}
                  spanLabel={t('binDesigner.wallCutouts.span')}
                  heightLabel={t('binDesigner.wallCutouts.height')}
                  step={STEP}
                />
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
