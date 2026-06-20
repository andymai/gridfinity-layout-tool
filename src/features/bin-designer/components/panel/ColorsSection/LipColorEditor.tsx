/**
 * Stacking-lip color editor: a Corners × Bands grid. The user picks how many
 * corner quadrants (1/2/4) and height bands (1/2/4) to color, then sets each
 * resulting cell. Counts are non-destructive — the underlying 16-cell store
 * persists, so collapsing then re-expanding round-trips colors.
 *
 * Reuses ColorZoneRow per active cell so each cell inherits the full picker
 * (presets, recent colors, eyedropper/swap interplay, undo-coalescing
 * gestures). The bare-`lip` umbrella hover is fired from the section header
 * row; here each cell fires its own zone so the matching region glows.
 */

import { SegmentedControl } from '@/design-system/SegmentedControl/SegmentedControl';
import { useTranslation } from '@/i18n';
import {
  activeLipCells,
  parseLipCell,
  LIP_AXIS_COUNTS,
  type ColorZone,
  type HoverableZone,
  type LipAxisCount,
  type LipCellZone,
  type LipColorConfig,
  type LipCorner,
} from '@/features/bin-designer/types/featureColors';
import { ColorZoneRow } from './ColorZoneRow';
import { LipGridDiagram } from './LipGridDiagram';

interface LipColorEditorProps {
  lip: LipColorConfig;
  bodyColor: string;
  hovered: HoverableZone | null;
  recentColors: readonly string[];
  swapActive: boolean;
  otherColorsFor: (zone: ColorZone) => readonly string[];
  onSetCorners: (n: LipAxisCount) => void;
  onSetBands: (n: LipAxisCount) => void;
  onChangeCell: (zone: LipCellZone, hex: string) => void;
  onHover: (zone: HoverableZone | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSwap: (zone: ColorZone) => void;
}

const AXIS_OPTIONS = LIP_AXIS_COUNTS.map((n) => ({ value: String(n), label: String(n) }));
const toAxis = (v: string): LipAxisCount => (v === '2' ? 2 : v === '4' ? 4 : 1);

/** Corner label key by active corner count (1 = whole lip, 2 = front/back). */
function cornerLabelKey(corner: LipCorner, corners: LipAxisCount): string {
  if (corners === 1) return 'binDesigner.colors.lip';
  if (corners === 2) {
    return corner === 'frontLeft' ? 'binDesigner.colors.lip.front' : 'binDesigner.colors.lip.back';
  }
  return `binDesigner.colors.lip.${corner}`;
}

export function LipColorEditor({
  lip,
  bodyColor,
  hovered,
  recentColors,
  swapActive,
  otherColorsFor,
  onSetCorners,
  onSetBands,
  onChangeCell,
  onHover,
  onGestureStart,
  onGestureEnd,
  onSwap,
}: LipColorEditorProps) {
  const t = useTranslation();
  const cells = activeLipCells({ corners: lip.corners, bands: lip.bands });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <LipGridDiagram lip={lip} hovered={hovered} onHover={onHover} />
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="flex items-center justify-between gap-2 text-[11px] text-content-secondary">
            <span>{t('binDesigner.colors.lip.cornersLabel')}</span>
            <SegmentedControl
              size="sm"
              aria-label={t('binDesigner.colors.lip.cornersLabel')}
              options={AXIS_OPTIONS}
              value={String(lip.corners)}
              onChange={(v) => onSetCorners(toAxis(v))}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-[11px] text-content-secondary">
            <span>{t('binDesigner.colors.lip.bandsLabel')}</span>
            <SegmentedControl
              size="sm"
              aria-label={t('binDesigner.colors.lip.bandsLabel')}
              options={AXIS_OPTIONS}
              value={String(lip.bands)}
              onChange={(v) => onSetBands(toAxis(v))}
            />
          </label>
        </div>
      </div>

      <div className="space-y-0.5">
        {cells.map((zone) => {
          const cell = parseLipCell(zone);
          if (!cell) return null;
          const cornerLabel = t(cornerLabelKey(cell.corner, lip.corners));
          const label =
            lip.bands > 1
              ? `${cornerLabel} · ${t('binDesigner.colors.lip.bandN', { n: cell.band + 1 })}`
              : cornerLabel;
          return (
            <ColorZoneRow
              key={zone}
              zone={zone}
              label={label}
              color={lip.cells[zone] ?? bodyColor}
              defaultColor={bodyColor}
              otherColors={otherColorsFor(zone)}
              bodyColor={bodyColor}
              recentColors={recentColors}
              onChange={(hex) => onChangeCell(zone, hex)}
              onHover={onHover}
              onGestureStart={onGestureStart}
              onGestureEnd={onGestureEnd}
              onClickOverride={swapActive ? () => onSwap(zone) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
