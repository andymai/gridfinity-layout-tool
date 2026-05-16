/**
 * Colors section: per-zone color assignment, grouped into collapsible
 * sub-sections (Exterior / Interior / Add-ons).
 *
 * Lip is rendered as a single expandable row that fans out into four
 * per-corner sub-rows. Hidden-feature zones (no scoop, no dividers,
 * etc.) don't render at all — no greyed-out rows.
 *
 * Only mounted when the multi_color_export Labs flag is on.
 */

import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import {
  LIP_CORNERS,
  getZoneColor,
  lipCornerZone,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone, LipCorner } from '@/features/bin-designer/types/featureColors';
import { useTranslation } from '@/i18n';
import { ColorZoneRow } from './ColorZoneRow';
import { LipZoneRow } from './LipZoneRow';
import { ColorGroup } from './ColorGroup';

/** Build the deduped list of OTHER active zone colors (excludes the current one). */
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
  const [lipExpanded, setLipExpanded] = useState(false);

  const {
    featureColors: rawColors,
    hasLip,
    hasLabelTabs,
    hasScoop,
    hasDividers,
  } = useDesignerStore(
    useShallow((s) => {
      const cells = s.params.compartments.cells;
      const firstCell = cells[0] ?? 0;
      return {
        featureColors: s.params.featureColors,
        hasLip: s.params.base.stackingLip,
        hasLabelTabs: s.params.label.enabled,
        hasScoop: s.params.scoop.enabled,
        hasDividers: cells.length > 1 && cells.some((c) => c !== firstCell),
      };
    })
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

  // Map of *active* zone → color. Drives the "Used in this design"
  // suggestion list per row and stays in sync with hidden-zone filtering.
  const colorsByZone = useMemo(() => {
    const map = new Map<ColorZone, string>();
    map.set('body', featureColors.body);
    map.set('base', featureColors.base);
    if (hasLip) {
      for (const corner of LIP_CORNERS) {
        map.set(lipCornerZone(corner), featureColors.lip[corner]);
      }
    }
    if (hasLabelTabs) map.set('labelTab', featureColors.labelTab);
    if (hasScoop) map.set('scoop', featureColors.scoop);
    if (hasDividers) map.set('dividers', featureColors.dividers);
    return map;
  }, [featureColors, hasLip, hasLabelTabs, hasScoop, hasDividers]);

  /** Render a leaf ColorZoneRow for a non-lip zone. */
  const renderZone = (
    zone: ColorZone,
    label: string,
    color: string,
    defaultColor: string,
    onChange: (hex: string) => void
  ) => (
    <ColorZoneRow
      zone={zone}
      label={label}
      color={color}
      defaultColor={defaultColor}
      otherColors={buildOtherColors(zone, colorsByZone)}
      onChange={onChange}
      onHover={setHoveredColorZone}
      onGestureStart={startTransaction}
      onGestureEnd={commitTransaction}
    />
  );

  const lipCornerLabel: Record<LipCorner, string> = {
    frontLeft: t('binDesigner.colors.lip.frontLeft'),
    frontRight: t('binDesigner.colors.lip.frontRight'),
    backRight: t('binDesigner.colors.lip.backRight'),
    backLeft: t('binDesigner.colors.lip.backLeft'),
  };

  return (
    <div className="space-y-2">
      <ColorGroup title={t('binDesigner.colors.group.exterior')}>
        {renderZone(
          'body',
          t('binDesigner.colors.body'),
          featureColors.body,
          DEFAULT_FEATURE_COLOR_CONFIG.body,
          (hex) => updateFeatureColors({ body: hex })
        )}
        {hasLip && (
          <>
            <LipZoneRow
              label={t('binDesigner.colors.lip')}
              corners={featureColors.lip}
              isExpanded={lipExpanded}
              onToggleExpand={() => setLipExpanded((v) => !v)}
              onHover={setHoveredColorZone}
            />
            {lipExpanded && (
              <div className="pl-7 space-y-0.5">
                {LIP_CORNERS.map((corner) => {
                  const zone = lipCornerZone(corner);
                  return (
                    <ColorZoneRow
                      key={corner}
                      zone={zone}
                      label={lipCornerLabel[corner]}
                      color={getZoneColor(featureColors, zone)}
                      defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.lip[corner]}
                      otherColors={buildOtherColors(zone, colorsByZone)}
                      onChange={(hex) => updateFeatureColors({ lip: { [corner]: hex } })}
                      onHover={setHoveredColorZone}
                      onGestureStart={startTransaction}
                      onGestureEnd={commitTransaction}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
        {renderZone(
          'base',
          t('binDesigner.colors.base'),
          featureColors.base,
          DEFAULT_FEATURE_COLOR_CONFIG.base,
          (hex) => updateFeatureColors({ base: hex })
        )}
      </ColorGroup>

      <ColorGroup title={t('binDesigner.colors.group.interior')} visible={hasScoop || hasDividers}>
        {hasScoop &&
          renderZone(
            'scoop',
            t('binDesigner.colors.scoop'),
            featureColors.scoop,
            DEFAULT_FEATURE_COLOR_CONFIG.scoop,
            (hex) => updateFeatureColors({ scoop: hex })
          )}
        {hasDividers &&
          renderZone(
            'dividers',
            t('binDesigner.colors.dividers'),
            featureColors.dividers,
            DEFAULT_FEATURE_COLOR_CONFIG.dividers,
            (hex) => updateFeatureColors({ dividers: hex })
          )}
      </ColorGroup>

      <ColorGroup title={t('binDesigner.colors.group.addons')} visible={hasLabelTabs}>
        {hasLabelTabs &&
          renderZone(
            'labelTab',
            t('binDesigner.colors.labelTab'),
            featureColors.labelTab,
            DEFAULT_FEATURE_COLOR_CONFIG.labelTab,
            (hex) => updateFeatureColors({ labelTab: hex })
          )}
      </ColorGroup>
    </div>
  );
}
