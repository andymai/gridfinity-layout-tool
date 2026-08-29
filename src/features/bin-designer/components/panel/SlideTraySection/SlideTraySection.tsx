/**
 * Sliding tray section: a rail on the bin plus the tray that rides it.
 *
 * The mount picker is the consequential control, so it sits in the primary
 * controls rather than behind Customize: `interior` keeps the tray inside one
 * bin, `rim` lets it cross to a neighbouring railed bin, and nothing else in
 * the panel hints at that difference.
 *
 * When the bin cannot carry a tray at all the toggle is disabled with the
 * reason, rather than letting a user switch the feature on and watch nothing
 * appear.
 *
 * The `sliding_tray` gate lives here rather than at the mount site: this
 * section is the only thing in the app that can set `slide.enabled`, so gating
 * the component itself keeps a future second mount point from reopening the
 * feature while it is unfinished. The gate is its own component so that
 * `useSlideTraySection` — which subscribes to the whole `params` object and
 * re-resolves the slide geometry on every edit — does not run for the users
 * who cannot see the section.
 */

import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { PanelSection } from '../PanelSection';
import { FeatureToggle } from '../FeatureToggle';
import { StepperField } from '../shared';
import { SegmentedControl } from '@/design-system';
import { useSlideTraySection } from './useSlideTraySection';
import { SlideFitSampleButton } from './SlideFitSampleButton';
import type { SlideRailMount } from '@/features/bin-designer/types';

const MOUNTS: readonly SlideRailMount[] = ['interior', 'rim'];

export function SlideTraySection() {
  // The gate also owns the PanelSection wrapper: rendering the wrapper around a
  // null child would leave an empty hairline band in the page's divide-y stack.
  return useFeatureFlag('sliding_tray') ? (
    <PanelSection helpTarget="bd-slide-tray">
      <SlideTrayControls />
    </PanelSection>
  ) : null;
}

function SlideTrayControls() {
  const t = useTranslation();
  const { slide, meta, blockedReason, protrusionMm, constraints, handlers } = useSlideTraySection();

  return (
    <FeatureToggle
      label={t('binDesigner.slideTray.title')}
      checked={slide.enabled}
      onChange={handlers.toggle}
      valueSummary={meta.summary}
      disabledReason={blockedReason}
      primaryControls={
        <>
          <SegmentedControl
            value={slide.railMount}
            onChange={(v) => handlers.setMount(v)}
            options={MOUNTS.map((m) => ({
              value: m,
              label: t(`binDesigner.slideTray.mount.${m}`),
            }))}
            aria-label={t('binDesigner.slideTray.mountAria')}
          />
          <p className="text-label leading-relaxed text-content-tertiary">
            {t(`binDesigner.slideTray.mountHint.${slide.railMount}`)}
          </p>
          <div className="flex gap-2">
            <StepperField
              label={t('binDesigner.slideTray.trayWidth')}
              unit="u"
              value={slide.trayWidthUnits}
              onChange={handlers.setTrayWidthUnits}
              onStep={(delta) => handlers.setTrayWidthUnits(slide.trayWidthUnits + delta * 0.5)}
              min={constraints.MIN_TRAY_WIDTH_UNITS}
              max={constraints.MAX_TRAY_WIDTH_UNITS}
              step={0.5}
              size="md"
              aria-label={t('binDesigner.slideTray.trayWidthAria')}
            />
            <StepperField
              label={t('binDesigner.slideTray.trayHeight')}
              unit="mm"
              value={slide.trayDepthMm}
              onChange={handlers.setTrayDepthMm}
              onStep={(delta) => handlers.setTrayDepthMm(slide.trayDepthMm + delta * 1)}
              min={constraints.MIN_TRAY_DEPTH_MM}
              max={constraints.MAX_TRAY_DEPTH_MM}
              step={1}
              size="md"
              aria-label={t('binDesigner.slideTray.trayHeightAria')}
            />
          </div>
          {protrusionMm !== null && (
            <p className="text-label leading-relaxed text-content-tertiary">
              {t('binDesigner.slideTray.protrudes', { mm: protrusionMm.toFixed(1) })}
            </p>
          )}
        </>
      }
    >
      <div className="flex gap-2">
        <StepperField
          label={t('binDesigner.slideTray.railDrop')}
          unit="mm"
          value={slide.railDropMm}
          onChange={handlers.setRailDropMm}
          onStep={(delta) => handlers.setRailDropMm(slide.railDropMm + delta * 1)}
          min={constraints.MIN_RAIL_DROP_MM}
          max={constraints.MAX_RAIL_DROP_MM}
          step={1}
          size="md"
          aria-label={t('binDesigner.slideTray.railDropAria')}
        />
        <StepperField
          label={t('binDesigner.slideTray.clearance')}
          unit="mm"
          value={slide.clearanceMm}
          onChange={handlers.setClearanceMm}
          onStep={(delta) => handlers.setClearanceMm(slide.clearanceMm + delta * 0.05)}
          min={constraints.MIN_CLEARANCE_MM}
          max={constraints.MAX_CLEARANCE_MM}
          step={0.05}
          size="md"
          aria-label={t('binDesigner.slideTray.clearanceAria')}
        />
      </div>
      <p className="text-label leading-relaxed text-content-tertiary">
        {t('binDesigner.slideTray.clearanceHint')}
      </p>
      <SlideFitSampleButton />
    </FeatureToggle>
  );
}
