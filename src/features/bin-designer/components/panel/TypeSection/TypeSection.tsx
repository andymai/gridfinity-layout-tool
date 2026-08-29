/**
 * Design-wide typography section.
 *
 * A preset picker over a disclosure holding the individual knobs. The presets
 * exist because the type system has roughly a dozen fields and almost nobody
 * wants to assemble a coherent look out of them; the knobs exist because the
 * few who do should not be blocked by a curated list.
 */

import {
  Alert,
  Button,
  Checkbox,
  SegmentedControl,
  Select,
  Slider,
  Stepper,
} from '@/design-system';
import type { ReactNode } from 'react';
import { MoreDisclosure } from '@/shared/components/MoreDisclosure';
import type { SegmentedControlOption } from '@/design-system';
import {
  TEXT_CASES,
  TEXT_CUT_PROFILES,
  TEXT_FONT_FAMILIES,
  TEXT_PRESET_IDS,
} from '@/features/bin-designer/types';
import type {
  TextCase,
  TextCutProfile,
  TextMode,
  TextSizeMode,
} from '@/features/bin-designer/types';
import { cn } from '@/design-system/cn';
import { AnchorPicker } from '../../controls/AnchorPicker';
import { TypeSpecimen } from '../../controls/TypeSpecimen';
import { useTypeSection, TYPE_BOUNDS } from './useTypeSection';

const TEXT_MODE_OPTIONS: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'] as const;
const SIZE_MODE_OPTIONS: readonly TextSizeMode[] = ['auto', 'fixed'] as const;

/** Stepper with the caption every other panel section draws above its own. */
function LabelledStepper({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs text-content-tertiary">{label}</span>
      {children}
    </div>
  );
}

export function TypeSection() {
  const { t, state, handlers } = useTypeSection();
  const { style } = state;

  const caseOptions: SegmentedControlOption<TextCase>[] = TEXT_CASES.map((value) => ({
    value,
    label: t(`binDesigner.type.case.${value}`),
  }));
  const profileOptions: SegmentedControlOption<TextCutProfile>[] = TEXT_CUT_PROFILES.map(
    (value) => ({ value, label: t(`binDesigner.type.profile.${value}`) })
  );

  return (
    <div className="space-y-3">
      <span className="block text-xs font-medium text-content-secondary">
        {t('binDesigner.type.heading')}
      </span>

      <div className="flex flex-wrap gap-1.5">
        {TEXT_PRESET_IDS.map((id) => {
          const active = state.activePreset === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              aria-pressed={active}
              onClick={() => handlers.applyPreset(id)}
              className={cn(
                'h-auto rounded-full border px-2.5 py-1 text-label transition-colors',
                active
                  ? 'border-accent bg-accent/15 text-accent hover:bg-accent/15 hover:text-accent'
                  : 'border-stroke-subtle bg-surface-elevated text-content-secondary hover:border-accent/50 hover:text-content'
              )}
            >
              {t(`binDesigner.type.preset.${id}`)}
            </Button>
          );
        })}
        {state.activePreset === null && (
          <span className="self-center rounded-full border border-stroke-subtle px-2.5 py-1 text-label text-content-tertiary">
            {t('binDesigner.type.preset.custom')}
          </span>
        )}
      </div>

      <TypeSpecimen text={state.specimenText} style={style} />

      {state.stemWarning && (
        <Alert intent="warning">
          <div className="space-y-1.5">
            <p className="text-label leading-relaxed">{t('binDesigner.type.stemWarning')}</p>
            {/* The measurement, not just the verdict: it is what tells the user
                how far they have to move, and it came from the built geometry. */}
            <p className="text-label leading-relaxed text-content-tertiary">
              {t('binDesigner.type.stemMeasured', {
                stem: state.stemWarning.minStemMm.toFixed(2),
                min: state.stemWarning.minPrintableStemMm.toFixed(1),
                size: state.stemWarning.fontSizeMm.toFixed(1),
              })}
            </p>
            <Button size="sm" variant="secondary" onClick={handlers.fixStem}>
              {t(`binDesigner.type.stemFix.${state.stemFixAction}`)}
            </Button>
          </div>
        </Alert>
      )}

      <Select
        aria-label={t('binDesigner.type.font')}
        size="sm"
        fullWidth
        value={style.font}
        onChange={(e) => handlers.setFont(e.target.value as (typeof TEXT_FONT_FAMILIES)[number])}
        options={TEXT_FONT_FAMILIES.map((font) => ({
          id: font,
          name: t(`binDesigner.type.font.${font}`),
        }))}
      />
      <SegmentedControl
        aria-label={t('binDesigner.type.case')}
        activeStyle="accent"
        fullWidth
        size="sm"
        value={style.textCase}
        onChange={handlers.setTextCase}
        options={caseOptions}
      />

      {/* The anchor grid takes its own row rather than sitting beside the case
          control: three case options plus a 3x3 grid overflow the panel's width
          and clip each other's labels. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-label text-content-tertiary">{t('binDesigner.type.anchor')}</span>
        <AnchorPicker value={style.anchor} onChange={handlers.setAnchor} />
      </div>

      {state.stencilSubstituted && (
        <p className="text-label leading-relaxed text-content-tertiary">
          {t('binDesigner.textMode.throughCutStencilNote')}
        </p>
      )}

      <SegmentedControl
        aria-label={t('binDesigner.type.sizeMode')}
        activeStyle="accent"
        fullWidth
        size="sm"
        value={style.sizeMode}
        onChange={handlers.setSizeMode}
        options={SIZE_MODE_OPTIONS.map((value) => ({
          value,
          label: t(`binDesigner.type.sizeMode.${value}`),
        }))}
      />

      {state.isFixedSize ? (
        <>
          <LabelledStepper label={t('binDesigner.type.fixedSize')}>
            <Stepper
              aria-label={t('binDesigner.type.fixedSize')}
              value={style.fixedSize}
              onStep={(delta) => handlers.step('fixedSize', delta)}
              min={TYPE_BOUNDS.fixedSize.min}
              max={TYPE_BOUNDS.fixedSize.max}
              step={TYPE_BOUNDS.fixedSize.step}
              size="sm"
              fullWidth
            />
          </LabelledStepper>
          <p className="text-label leading-relaxed text-content-tertiary">
            {t('binDesigner.type.fixedSizeHint')}
          </p>
        </>
      ) : (
        <>
          <Checkbox
            label={t('binDesigner.type.snapToScale')}
            checked={style.snapToScale}
            onChange={handlers.setSnapToScale}
          />
          <Checkbox
            label={t('binDesigner.type.uniformAcrossWalls')}
            checked={style.uniformAcrossWalls}
            onChange={handlers.setUniformAcrossWalls}
          />
        </>
      )}

      <MoreDisclosure label={t('binDesigner.type.advanced')}>
        <div className="space-y-3 pt-2">
          <SegmentedControl
            aria-label={t('binDesigner.textMode')}
            activeStyle="accent"
            fullWidth
            size="sm"
            value={style.mode}
            onChange={handlers.setMode}
            options={TEXT_MODE_OPTIONS.map((mode) => ({
              value: mode,
              label: t(`binDesigner.textMode.${mode}`),
            }))}
          />
          <div className="space-y-1">
            <span className="block text-label text-content-tertiary">
              {t('binDesigner.type.tracking')}
            </span>
            <Slider
              value={style.tracking}
              onChange={handlers.setTracking}
              min={TYPE_BOUNDS.tracking.min}
              max={TYPE_BOUNDS.tracking.max}
              step={TYPE_BOUNDS.tracking.step}
              aria-label={t('binDesigner.type.tracking')}
            />
            <Checkbox
              label={t('binDesigner.type.autoTracking')}
              checked={style.autoTracking}
              onChange={handlers.setAutoTracking}
            />
          </div>
          <LabelledStepper label={t('binDesigner.type.lineScale')}>
            <Stepper
              aria-label={t('binDesigner.type.lineScale')}
              value={style.lineScale}
              onStep={(delta) => handlers.step('lineScale', delta)}
              min={TYPE_BOUNDS.lineScale.min}
              max={TYPE_BOUNDS.lineScale.max}
              step={TYPE_BOUNDS.lineScale.step}
              size="sm"
              fullWidth
            />
          </LabelledStepper>
          <LabelledStepper label={t('binDesigner.type.margin')}>
            <Stepper
              aria-label={t('binDesigner.type.margin')}
              value={style.margin}
              onStep={(delta) => handlers.step('margin', delta)}
              min={TYPE_BOUNDS.margin.min}
              max={TYPE_BOUNDS.margin.max}
              step={TYPE_BOUNDS.margin.step}
              size="sm"
              fullWidth
            />
          </LabelledStepper>
          <LabelledStepper label={t('binDesigner.type.depth')}>
            <Stepper
              aria-label={t('binDesigner.type.depth')}
              value={style.depth}
              onStep={(delta) => handlers.step('depth', delta)}
              min={TYPE_BOUNDS.depth.min}
              max={TYPE_BOUNDS.depth.max}
              step={TYPE_BOUNDS.depth.step}
              size="sm"
              fullWidth
            />
          </LabelledStepper>
          <SegmentedControl
            aria-label={t('binDesigner.type.profile')}
            activeStyle="accent"
            fullWidth
            size="sm"
            value={style.cutProfile}
            onChange={handlers.setCutProfile}
            options={profileOptions}
          />
          {state.isDrafted && (
            <LabelledStepper label={t('binDesigner.type.draftAngle')}>
              <Stepper
                aria-label={t('binDesigner.type.draftAngle')}
                value={style.draftAngleDeg}
                onStep={(delta) => handlers.step('draftAngleDeg', delta)}
                min={TYPE_BOUNDS.draftAngleDeg.min}
                max={TYPE_BOUNDS.draftAngleDeg.max}
                step={TYPE_BOUNDS.draftAngleDeg.step}
                size="sm"
                fullWidth
              />
            </LabelledStepper>
          )}
        </div>
      </MoreDisclosure>
    </div>
  );
}
