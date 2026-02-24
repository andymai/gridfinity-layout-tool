/**
 * Parameter panel for the standalone baseplate page.
 *
 * Shows grid dimensions (read-only), per-side padding steppers, magnet toggle
 * with customize controls, and a summary card. Styled to match the bin
 * designer's panel patterns.
 */

import { useCallback, useState, useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';
import type { BaseplateParams } from '@/core/types';

export function BaseplatePanel() {
  const t = useTranslation();

  const { drawerWidth, drawerDepth, gridUnitMm, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const updateParam = useCallback(
    <K extends keyof BaseplateParams>(key: K, value: BaseplateParams[K]) => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, [key]: value });
    },
    []
  );

  const gridWidthMm = drawerWidth * gridUnitMm;
  const gridDepthMm = drawerDepth * gridUnitMm;

  const totalWidthMm = gridWidthMm + baseplateParams.paddingLeft + baseplateParams.paddingRight;
  const totalDepthMm = gridDepthMm + baseplateParams.paddingFront + baseplateParams.paddingBack;
  const hasPadding =
    baseplateParams.paddingLeft > 0 ||
    baseplateParams.paddingRight > 0 ||
    baseplateParams.paddingFront > 0 ||
    baseplateParams.paddingBack > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Padding section */}
        <div className="border-b border-stroke-subtle/50 px-4 py-4">
          <div className="space-y-3">
            {/* Grid dimensions (read-only info line) */}
            <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
                />
              </svg>
              <span className="tabular-nums">
                {t('baseplate.gridDimensions', {
                  width: Math.round(gridWidthMm),
                  depth: Math.round(gridDepthMm),
                })}
              </span>
            </div>

            {/* Per-side padding steppers — 2×2 grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <PaddingStepper
                label={t('baseplate.paddingLeft')}
                value={baseplateParams.paddingLeft}
                onChange={(v) => updateParam('paddingLeft', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingRight')}
                value={baseplateParams.paddingRight}
                onChange={(v) => updateParam('paddingRight', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingFront')}
                value={baseplateParams.paddingFront}
                onChange={(v) => updateParam('paddingFront', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingBack')}
                value={baseplateParams.paddingBack}
                onChange={(v) => updateParam('paddingBack', v)}
              />
            </div>

            {/* Total dimensions when padding is set */}
            {hasPadding && (
              <div className="text-[11px] tabular-nums text-content-tertiary">
                {t('baseplate.totalDimensions', {
                  width: Math.round(totalWidthMm),
                  depth: Math.round(totalDepthMm),
                })}
              </div>
            )}
          </div>
        </div>

        {/* Magnet holes section */}
        <div className="px-4 py-4">
          <MagnetToggle
            checked={baseplateParams.magnetHoles}
            onToggle={() => updateParam('magnetHoles', !baseplateParams.magnetHoles)}
            magnetDiameter={baseplateParams.magnetDiameter}
            magnetDepth={baseplateParams.magnetDepth}
            onDiameterChange={(v) => updateParam('magnetDiameter', v)}
            onDepthChange={(v) => updateParam('magnetDepth', v)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Compact stepper for a single padding value (mm). */
function PaddingStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-content-tertiary">{label}</span>
      <Stepper
        size="sm"
        value={value}
        onChange={onChange}
        onStep={(delta) => onChange(Math.max(0, value + delta))}
        min={0}
        max={100}
        step={0.5}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Magnet holes toggle with inline "Customize" expand.
 * Matches the bin designer's FeatureToggle pattern.
 */
function MagnetToggle({
  checked,
  onToggle,
  magnetDiameter,
  magnetDepth,
  onDiameterChange,
  onDepthChange,
}: {
  checked: boolean;
  onToggle: () => void;
  magnetDiameter: number;
  magnetDepth: number;
  onDiameterChange: (v: number) => void;
  onDepthChange: (v: number) => void;
}) {
  const t = useTranslation();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      {/* Toggle row */}
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-content-secondary">{t('baseplate.magnetHoles')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={t('baseplate.magnetHoles')}
          onClick={onToggle}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
            checked ? 'bg-accent' : 'bg-stroke-subtle'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Value summary + Customize link */}
      {checked && (
        <div className="ml-1 mt-0.5">
          <div className="flex items-center gap-2">
            {!customizeOpen && (
              <span className="text-[11px] text-content-tertiary">
                {`\u00f8${magnetDiameter}mm \u00d7 ${magnetDepth}mm`}
              </span>
            )}
            <button
              type="button"
              onClick={() => setCustomizeOpen(!customizeOpen)}
              aria-expanded={customizeOpen}
              aria-controls={contentId}
              className="text-xs font-medium text-accent py-2 -my-2 hover:text-accent/80 transition-colors"
            >
              {customizeOpen ? t('common.done') : t('baseplate.customize')}
            </button>
          </div>

          {/* Inline expand for detailed controls */}
          <div
            id={contentId}
            role="region"
            aria-label={`${t('baseplate.magnetHoles')} settings`}
            aria-hidden={!customizeOpen}
            className={`overflow-hidden transition-all duration-200 ${
              customizeOpen ? 'opacity-100 max-h-[500px] mt-2' : 'opacity-0 max-h-0'
            }`}
          >
            <div className="space-y-3 border-l-2 border-accent/20 pl-3 pb-1">
              <MagnetSlider
                label={t('baseplate.magnetDiameter')}
                value={magnetDiameter}
                onChange={onDiameterChange}
                min={1}
                max={20}
                step={0.1}
                unit="mm"
              />
              <MagnetSlider
                label={t('baseplate.magnetDepth')}
                value={magnetDepth}
                onChange={onDepthChange}
                min={0.5}
                max={10}
                step={0.1}
                unit="mm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Combined slider + number input for magnet dimensions.
 * Matches the bin designer's SliderInput pattern.
 */
function MagnetSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  const id = useId();

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-content-secondary">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={id}
            type="number"
            value={value}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (Number.isFinite(val) && val >= min && val <= max) {
                onChange(val);
              }
            }}
            min={min}
            max={max}
            step={step}
            className="w-16 rounded border border-stroke-subtle bg-surface px-1.5 py-1 text-right text-xs tabular-nums text-content"
          />
          <span className="text-xs text-content-tertiary">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 rounded-full appearance-none bg-stroke-subtle accent-accent cursor-pointer py-2"
        aria-label={`${label} slider`}
      />
    </div>
  );
}
