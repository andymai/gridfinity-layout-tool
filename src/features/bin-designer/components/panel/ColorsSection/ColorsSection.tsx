/**
 * Colors section: per-zone color assignment with direct color pickers.
 *
 * Shows a ColorZoneRow per active zone (body, lip if enabled, label tab if enabled).
 * Zones are hidden when their feature is disabled — no greyed-out rows.
 * Only rendered when multi_color_export Labs flag is enabled.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { useTranslation } from '@/i18n';
import { ColorZoneRow } from './ColorZoneRow';

export function ColorsSection() {
  const t = useTranslation();

  const {
    featureColors: rawColors,
    hasLip,
    hasLabelTabs,
  } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors,
      hasLip: s.params.base.stackingLip,
      hasLabelTabs: s.params.label.enabled,
    }))
  );

  const featureColors = rawColors ?? DEFAULT_FEATURE_COLOR_CONFIG;
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);

  return (
    <div className="space-y-1">
      <ColorZoneRow
        label={t('binDesigner.colors.body')}
        color={featureColors.body}
        onChange={(hex) => updateFeatureColors({ body: hex })}
      />
      {hasLip && (
        <ColorZoneRow
          label={t('binDesigner.colors.lip')}
          color={featureColors.lip}
          onChange={(hex) => updateFeatureColors({ lip: hex })}
        />
      )}
      {hasLabelTabs && (
        <ColorZoneRow
          label={t('binDesigner.colors.labelTab')}
          color={featureColors.labelTab}
          onChange={(hex) => updateFeatureColors({ labelTab: hex })}
        />
      )}
    </div>
  );
}
