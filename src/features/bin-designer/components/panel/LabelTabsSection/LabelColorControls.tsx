/**
 * Label color controls surfaced directly in the Label section (#2461).
 *
 * Labels are colorable through the multi-color `featureColors` model — the
 * raised tab (`labelTab`) and the engraved text (`text`) are distinct zones.
 * Those zones are otherwise only reachable from the experimental Colors
 * section, so users designing a label never discover them. These two swatches
 * drive the same `featureColors` slots and auto-enable multi-color the moment a
 * non-body color is picked, so a chosen color actually renders and exports
 * instead of silently doing nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { normalizeHex } from '@/features/bin-designer/types/featureColors';
import { useTranslation } from '@/i18n';
import { useSwapZoneWithToast } from '@/features/bin-designer/hooks/useSwapZoneWithToast';
import { ColorZoneRow } from '../ColorsSection/ColorZoneRow';

const RECENT_COLORS_LIMIT = 8;

/** Sibling zone colors offered as quick-picks in the picker, deduped and
 *  excluding the row's own current color. */
function otherColors(current: string, ...candidates: string[]): string[] {
  const seen = new Set<string>([current.toLowerCase()]);
  const result: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

export function LabelColorControls() {
  const t = useTranslation();
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);

  const { featureColors, colorTool } = useDesignerStore(
    useShallow((s) => ({
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
      featureColors: s.params.featureColors ?? DEFAULT_FEATURE_COLOR_CONFIG,
      colorTool: s.ui.colorTool,
    }))
  );
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);
  const swapZoneWithToast = useSwapZoneWithToast();

  // While the swap-colors tool is active (entered from the Colors section), a
  // row click should pick the zone for the swap rather than open the picker —
  // same contract as ColorsSection so the label swatches participate too.
  const swapActive = colorTool === 'swap-pick-first' || colorTool === 'swap-pick-second';

  // Release the preview glow if this section unmounts while a row is hovered.
  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  const remember = useCallback((hex: string) => {
    const lower = hex.toLowerCase();
    setRecentColors((prev) =>
      [lower, ...prev.filter((c) => c !== lower)].slice(0, RECENT_COLORS_LIMIT)
    );
  }, []);

  const bodyColor = featureColors.body;
  const tabColor = featureColors.labelTab;
  const textColor = featureColors.text;

  const applyColor = useCallback(
    (patch: { labelTab?: string } | { text?: string }, hex: string) => {
      remember(hex);
      // Picking any non-body color implies the user wants it to show, so turn
      // on multi-color. Resetting a swatch back to the body color leaves the
      // toggle untouched (never force-enables for a no-op change).
      const enable = normalizeHex(hex) !== normalizeHex(bodyColor);
      updateFeatureColors(enable ? { ...patch, enabled: true } : patch);
    },
    [remember, updateFeatureColors, bodyColor]
  );

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-content-secondary">
        {t('binDesigner.labelColor')}
      </span>
      <div>
        <ColorZoneRow
          zone="labelTab"
          label={t('binDesigner.colors.labelTab')}
          color={tabColor}
          defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.labelTab}
          otherColors={otherColors(tabColor, textColor, bodyColor)}
          bodyColor={bodyColor}
          recentColors={recentColors}
          onChange={(hex) => applyColor({ labelTab: hex }, hex)}
          onHover={setHoveredColorZone}
          onGestureStart={startTransaction}
          onGestureEnd={commitTransaction}
          onClickOverride={swapActive ? () => swapZoneWithToast('labelTab') : undefined}
        />
        <ColorZoneRow
          zone="text"
          label={t('binDesigner.colors.text')}
          color={textColor}
          defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.text}
          otherColors={otherColors(textColor, tabColor, bodyColor)}
          bodyColor={bodyColor}
          recentColors={recentColors}
          onChange={(hex) => applyColor({ text: hex }, hex)}
          onHover={setHoveredColorZone}
          onGestureStart={startTransaction}
          onGestureEnd={commitTransaction}
          onClickOverride={swapActive ? () => swapZoneWithToast('text') : undefined}
        />
      </div>
    </div>
  );
}
