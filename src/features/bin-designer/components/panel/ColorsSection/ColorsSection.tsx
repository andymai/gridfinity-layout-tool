/**
 * Colors section: filament palette editing + per-zone swatch assignment.
 *
 * Shows PaletteHeader (edit palette slots) and FilamentSwatchRow per zone.
 * Only rendered when multi_color_export Labs flag is enabled.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { PaletteHeader } from './PaletteHeader';
import { FilamentSwatchRow } from './FilamentSwatchRow';

export function ColorsSection() {
  const t = useTranslation();

  const { featureColors, hasLip, hasLabelTabs } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors,
      hasLip: s.params.base.stackingLip,
      hasLabelTabs: s.params.label.enabled,
    }))
  );

  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);

  // Clear hovered zone on unmount to prevent stale preview glow
  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  return (
    <div className="space-y-4">
      <PaletteHeader />
      <div className="space-y-1">
        <FilamentSwatchRow
          zone="body"
          label={t('binDesigner.colors.body')}
          value={featureColors.body}
          onChange={(slotId) => updateFeatureColors({ body: slotId })}
          onHover={setHoveredColorZone}
        />
        <FilamentSwatchRow
          zone="lip"
          label={t('binDesigner.colors.lip')}
          value={featureColors.lip}
          onChange={(slotId) => updateFeatureColors({ lip: slotId })}
          onHover={setHoveredColorZone}
          disabled={!hasLip}
          disabledReason={t('binDesigner.colors.enableLipHint')}
        />
        <FilamentSwatchRow
          zone="labelTab"
          label={t('binDesigner.colors.labelTab')}
          value={featureColors.labelTab}
          onChange={(slotId) => updateFeatureColors({ labelTab: slotId })}
          onHover={setHoveredColorZone}
          disabled={!hasLabelTabs}
          disabledReason={t('binDesigner.colors.enableLabelTabHint')}
        />
      </div>
    </div>
  );
}
