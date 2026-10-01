import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { getZoneColor, normalizeHex } from '@/features/bin-designer/types/featureColors';
import { useActiveColorZones } from '@/features/bin-designer/hooks/useActiveColorZones';
import { useSwapZoneWithToast } from '@/features/bin-designer/hooks/useSwapZoneWithToast';
import type { TextSurface } from '@/features/bin-designer/utils/flatTextContrast';
import { ColorZoneRow } from '../ColorsSection/ColorZoneRow';
import { DependencyHint } from './DependencyHint';
import { FlatTextClashWarning } from './FlatTextClashWarning';

const RECENT_COLORS_LIMIT = 8;

interface TextColorControlProps {
  /** What this host's text sits on, for the hidden-letters check; omit for every host. */
  readonly surfaces?: readonly TextSurface[];
  /** Flat is the one finish that shows only in a second filament. */
  readonly flat: boolean;
}

/**
 * The Text colour, set right where the finish is chosen. Every host writes the
 * one shared `featureColors.text`, so the swatch reads the same everywhere.
 */
export function TextColorControl({ surfaces, flat }: TextColorControlProps) {
  const t = useTranslation();
  const multiColor = useDesignerStore((s) => s.params.featureColors.enabled);
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  // Same rule as the Colors section: no lettering anywhere, nothing to colour.
  const hasText = useActiveColorZones().has('text');

  if (!multiColor) {
    return flat ? (
      <DependencyHint
        reason={t('binDesigner.textColor.needsMultiColor')}
        actionLabel={t('binDesigner.textColor.turnOnMultiColor')}
        onAction={() => updateFeatureColors({ enabled: true })}
      />
    ) : null;
  }
  if (!hasText) return null;
  return (
    <div className="space-y-1">
      <TextColorRow />
      <FlatTextClashWarning surfaces={surfaces} />
    </div>
  );
}

function TextColorRow() {
  const t = useTranslation();
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);
  const { featureColors, colorTool } = useDesignerStore(
    useShallow((s) => ({ featureColors: s.params.featureColors, colorTool: s.ui.colorTool }))
  );
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);
  const swapZoneWithToast = useSwapZoneWithToast();
  const zones = useActiveColorZones();

  // Release the preview glow if the row unmounts while hovered.
  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  const otherColors = useMemo(() => {
    const seen = new Set([normalizeHex(featureColors.text)]);
    const out: string[] = [];
    for (const zone of zones) {
      const hex = normalizeHex(getZoneColor(featureColors, zone));
      if (seen.has(hex)) continue;
      seen.add(hex);
      out.push(hex);
    }
    return out;
  }, [zones, featureColors]);

  const onChange = useCallback(
    (hex: string) => {
      const lower = hex.toLowerCase();
      setRecentColors((prev) =>
        [lower, ...prev.filter((c) => c !== lower)].slice(0, RECENT_COLORS_LIMIT)
      );
      updateFeatureColors({ text: hex });
    },
    [updateFeatureColors]
  );

  const swapActive = colorTool === 'swap-pick-first' || colorTool === 'swap-pick-second';
  return (
    <ColorZoneRow
      zone="text"
      label={t('binDesigner.textColor')}
      color={featureColors.text}
      defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.text}
      otherColors={otherColors}
      bodyColor={featureColors.body}
      recentColors={recentColors}
      onChange={onChange}
      onHover={setHoveredColorZone}
      onGestureStart={startTransaction}
      onGestureEnd={commitTransaction}
      onClickOverride={swapActive ? () => swapZoneWithToast('text') : undefined}
    />
  );
}
