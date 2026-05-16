/**
 * Colors section: per-zone color assignment with direct color pickers.
 *
 * Shows a ColorZoneRow per active zone (body, lip if enabled, label tab
 * if enabled). Disabled-feature zones are hidden — no greyed-out rows.
 * Only rendered when the multi_color_export Labs flag is enabled.
 */

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { useTranslation } from '@/i18n';
import { ColorZoneRow } from './ColorZoneRow';

/** Build the dedup'd list of OTHER zones' colors (excludes the current color). */
function buildOtherColors(zone: ColorZone, colorsByZone: ReadonlyMap<ColorZone, string>): string[] {
  const current = colorsByZone.get(zone);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const [z, c] of colorsByZone) {
    if (z === zone) continue;
    const key = c.toLowerCase();
    if (key === current?.toLowerCase()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it; preserve the runtime fallback
  const featureColors = rawColors ?? DEFAULT_FEATURE_COLOR_CONFIG;
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  // Native-picker drags can fire dozens of change events per gesture
  // (worst case: Firefox during pointer drag). Wrap them in a transaction
  // so all the intermediate colors collapse into a single undo entry.
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);

  // Clear hovered zone on unmount to prevent stale preview glow
  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  // Map of *active* zone → color. Excludes hidden zones so the
  // "Used in this design" suggestions only reflect what the user sees.
  const colorsByZone = useMemo(() => {
    const map = new Map<ColorZone, string>();
    map.set('body', featureColors.body);
    if (hasLip) map.set('lip', featureColors.lip);
    if (hasLabelTabs) map.set('labelTab', featureColors.labelTab);
    return map;
  }, [featureColors, hasLip, hasLabelTabs]);

  return (
    <div className="space-y-0.5">
      <ColorZoneRow
        zone="body"
        label={t('binDesigner.colors.body')}
        color={featureColors.body}
        defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.body}
        otherColors={buildOtherColors('body', colorsByZone)}
        onChange={(hex) => updateFeatureColors({ body: hex })}
        onHover={setHoveredColorZone}
        onGestureStart={startTransaction}
        onGestureEnd={commitTransaction}
      />
      {hasLip && (
        <ColorZoneRow
          zone="lip"
          label={t('binDesigner.colors.lip')}
          color={featureColors.lip}
          defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.lip}
          otherColors={buildOtherColors('lip', colorsByZone)}
          onChange={(hex) => updateFeatureColors({ lip: hex })}
          onHover={setHoveredColorZone}
          onGestureStart={startTransaction}
          onGestureEnd={commitTransaction}
        />
      )}
      {hasLabelTabs && (
        <ColorZoneRow
          zone="labelTab"
          label={t('binDesigner.colors.labelTab')}
          color={featureColors.labelTab}
          defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.labelTab}
          otherColors={buildOtherColors('labelTab', colorsByZone)}
          onChange={(hex) => updateFeatureColors({ labelTab: hex })}
          onHover={setHoveredColorZone}
          onGestureStart={startTransaction}
          onGestureEnd={commitTransaction}
        />
      )}
    </div>
  );
}
