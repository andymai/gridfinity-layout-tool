/**
 * Wall cutouts section: U-shaped notches from the top of bin walls.
 *
 * Controls: master toggle, shape selector, side toggle chips, linked/independent mode,
 * span/height steppers with %/mm toggle, collapsible position controls (alignment + offset).
 */

import { useState } from 'react';
import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import type {
  WallSide,
  WallCutout,
  WallCutoutShape,
  LabelTabAlignment,
} from '@/features/bin-designer/types';

const SIDE_ORDER: readonly Exclude<WallSide, 'interior'>[] = ['left', 'right', 'front', 'back'];
const ALIGNMENT_OPTIONS: LabelTabAlignment[] = ['left', 'center', 'right'];
const OFFSET_STEP = 1;

const SHAPE_OPTIONS: readonly { value: WallCutoutShape; labelKey: string }[] = [
  { value: 'u-shape', labelKey: 'binDesigner.wallCutouts.shape.uShape' },
  { value: 'scoop', labelKey: 'binDesigner.wallCutouts.shape.scoop' },
  { value: 'funnel', labelKey: 'binDesigner.wallCutouts.shape.funnel' },
];

/** Inline SVG chain-link icon (12×12). */
function LinkIcon({ linked }: { linked: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      {linked ? (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      ) : (
        <>
          <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-3 3a5 5 0 0 0 .12 7.19" />
          <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l3-3a5 5 0 0 0-.12-7.19" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      )}
    </svg>
  );
}

/** Inline SVG chevron (8×8). */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Whether a cutout has non-default positioning (worth showing in collapsed label). */
function hasCustomPosition(cfg: WallCutout): boolean {
  return cfg.alignment !== 'center' || cfg.offset !== 0;
}

/** Span + height steppers on one row, with optional %/mm toggle on the span. */
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
  const isMmMode = cfg.widthMm !== null;

  return (
    <div className="flex items-end gap-2">
      {/* Span stepper */}
      <div className="flex-1 min-w-0">
        <span className="mb-1 block text-xs text-content-tertiary">{spanLabel}</span>
        {isMmMode ? (
          <StepperControl
            value={cfg.widthMm}
            onChange={(v) => handlers.setSideWidthMm(side, Math.max(1, v))}
            onStep={(delta) =>
              handlers.setSideWidthMm(side, Math.max(1, (cfg.widthMm as number) + delta))
            }
            min={1}
            max={500}
            step={1}
            variant="desktop"
            ariaLabel="Span mm"
          />
        ) : (
          <StepperControl
            value={cfg.width}
            onChange={(v) => handlers.setSideWidth(side, v)}
            onStep={(delta) =>
              handlers.setSideWidth(side, Math.max(0, Math.min(100, cfg.width + delta * step)))
            }
            min={0}
            max={100}
            step={step}
            variant="desktop"
            ariaLabel="Span %"
          />
        )}
      </div>

      {/* %/mm toggle */}
      <button
        type="button"
        onClick={() => handlers.setSideWidthMm(side, isMmMode ? null : 30)}
        className={`shrink-0 rounded px-1.5 py-1 text-xs font-medium transition-colors ${
          isMmMode
            ? 'bg-accent text-on-accent'
            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
        }`}
      >
        {isMmMode ? 'mm' : '%'}
      </button>

      {/* Height stepper */}
      {!hideDepth && (
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">{heightLabel}</span>
          <StepperControl
            value={cfg.depth}
            onChange={(v) => handlers.setSideDepth(side, v)}
            onStep={(delta) =>
              handlers.setSideDepth(side, Math.max(0, Math.min(100, cfg.depth + delta * step)))
            }
            min={0}
            max={100}
            step={step}
            variant="desktop"
            ariaLabel="Height %"
          />
        </div>
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
  const [manualOpen, setManualOpen] = useState(false);
  const isOpen = manualOpen || isCustom;

  const alignmentLabel = t(`binDesigner.alignment.${cfg.alignment}`);
  const summary = isCustom
    ? `${alignmentLabel}${cfg.offset !== 0 ? ` ${cfg.offset > 0 ? '+' : ''}${cfg.offset}mm` : ''}`
    : alignmentLabel;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManualOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-content-tertiary hover:text-content-secondary transition-colors"
      >
        <ChevronIcon open={isOpen} />
        <span>{t('binDesigner.wallCutouts.position')}:</span>
        <span className="text-content-secondary font-medium">{summary}</span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 ml-3.5">
          {/* Alignment picker */}
          <div className="flex gap-1">
            {ALIGNMENT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handlers.setSideAlignment(side, option)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  cfg.alignment === option
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                }`}
              >
                {t(`binDesigner.alignment.${option}`)}
              </button>
            ))}
          </div>

          {/* Offset stepper */}
          {(cfg.alignment !== 'center' || cfg.offset !== 0) && (
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.wallCutouts.offset')}
              </span>
              <StepperControl
                value={cfg.offset}
                onChange={(v) => handlers.setSideOffset(side, v)}
                onStep={(delta) => handlers.setSideOffset(side, cfg.offset + delta * OFFSET_STEP)}
                min={-50}
                max={50}
                step={OFFSET_STEP}
                variant="desktop"
                ariaLabel="Offset mm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WallCutoutsSection() {
  const { state, handlers, meta, t, STEP } = useWallCutoutsSection();
  const { walls, activeSides, linked } = state;

  const sharedSide = activeSides.length > 0 ? activeSides[0] : undefined;
  const hideDepth = walls.shape === 'scoop';

  return (
    <FeatureToggle
      label={t('binDesigner.wallCutouts')}
      checked={walls.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      primaryControls={
        <div className="space-y-3">
          {/* Shape selector */}
          <div className="flex gap-1">
            {SHAPE_OPTIONS.map(({ value, labelKey }) => {
              const isActive = walls.shape === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlers.setShape(value)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {/* Side toggle chips */}
          <div className="flex gap-1">
            {SIDE_ORDER.map((side) => {
              const isActive = walls[side].enabled;
              return (
                <button
                  key={side}
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => handlers.toggleSide(side)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(`binDesigner.wallCutouts.${side}`)}
                </button>
              );
            })}
          </div>

          {/* Controls — shown when at least one side is active */}
          {activeSides.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlers.toggleLinked}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    linked
                      ? 'bg-accent/10 text-accent'
                      : 'bg-surface-secondary text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  <LinkIcon linked={linked} />
                  {linked
                    ? t('binDesigner.wallCutouts.linked')
                    : t('binDesigner.wallCutouts.independent')}
                </button>
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
                    <label className="text-xs font-medium text-content-secondary block">
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

          {/* Interior walls */}
          <div className="border-t border-stroke-subtle/50 pt-2">
            <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={walls.interior.enabled}
                onChange={() => handlers.toggleSide('interior')}
                className="rounded border-stroke-subtle text-accent focus:ring-accent h-3.5 w-3.5"
              />
              {t('binDesigner.wallCutouts.interior')}
            </label>
            {walls.interior.enabled && !linked && (
              <div className="mt-2 ml-6">
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
