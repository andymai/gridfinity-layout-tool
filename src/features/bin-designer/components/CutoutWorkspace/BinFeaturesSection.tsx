/**
 * Bin-level feature toggles inside the cutout editor, so a shadow board or tool
 * tray can drop the stacking lip without leaving the workspace for the main
 * parameter panel. Self-wired to the designer store like the DimensionsSection
 * the BinSizeSection above it reuses.
 *
 * The toggle deliberately mirrors `useBaseSection.toggleStackingLip` — a bare
 * `updateBase`, no constraint-engine round trip — because the lip has no
 * feature id in the engine and a second surface inventing gating would make the
 * two controls disagree.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { FeatureToggle } from '../panel/FeatureToggle';

export function BinFeaturesSection() {
  const t = useTranslation();
  const { stackingLip, lidEnabled, updateBase } = useDesignerStore(
    useShallow((s) => ({
      stackingLip: s.params.base.stackingLip,
      lidEnabled: s.params.lid.enabled,
      updateBase: s.updateBase,
    }))
  );

  const toggleStackingLip = useCallback(() => {
    updateBase({ stackingLip: !stackingLip });
  }, [stackingLip, updateBase]);

  return (
    <div className="space-y-2 border-b border-stroke-subtle pb-3 pt-3">
      <span className="block text-micro font-semibold uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.cutoutEditor.binFeatures')}
      </span>

      {/* Same key as the Base section's toggle — one noun for one lip. */}
      <FeatureToggle
        label={t('assembledHeight.stackingLip')}
        checked={stackingLip}
        onChange={toggleStackingLip}
      />

      {/* The lid seats on the lip, so clearing it stops the lid generating while
          `lid.enabled` stays persisted (useLidSection's `effectiveEnabled`).
          The Lid section carries that warning in the main panel; it is off
          screen here, so the lid would otherwise vanish unexplained. */}
      {lidEnabled && !stackingLip && (
        <p className="text-label leading-relaxed text-content-tertiary">
          {t('binDesigner.cutoutEditor.lipOffPausesLid')}
        </p>
      )}
    </div>
  );
}
