/**
 * Stacking-lip color editor. Defaults to a single lip color — most users want
 * one — and hides the Corners × Bands grid behind a "Split into color zones"
 * opt-in. When split, the user picks how many corner quadrants (1/2/4) and
 * height bands (1/2/4) to color, then sets each resulting cell. Counts are
 * non-destructive — the underlying 16-cell store persists, so collapsing then
 * re-expanding round-trips colors.
 *
 * Reuses ColorZoneRow per active cell so each cell inherits the full picker
 * (presets, recent colors, eyedropper/swap interplay, undo-coalescing
 * gestures). The bare-`lip` umbrella hover is fired from the section header
 * row; here each cell fires its own zone so the matching region glows.
 */

import { useState } from 'react';
import { Checkbox } from '@/design-system';
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

// Literal keys (not built by template) so the unused-i18n checker sees them.
const FOUR_CORNER_KEY: Record<LipCorner, string> = {
  frontLeft: 'binDesigner.colors.lip.frontLeft',
  frontRight: 'binDesigner.colors.lip.frontRight',
  backRight: 'binDesigner.colors.lip.backRight',
  backLeft: 'binDesigner.colors.lip.backLeft',
};

/** Corner label key by active corner count (1 = whole lip, 2 = front/back). */
function cornerLabelKey(corner: LipCorner, corners: LipAxisCount): string {
  if (corners === 1) return 'binDesigner.colors.lip';
  if (corners === 2) {
    return corner === 'frontLeft' ? 'binDesigner.colors.lip.front' : 'binDesigner.colors.lip.back';
  }
  return FOUR_CORNER_KEY[corner];
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
  const isMultiCell = lip.corners > 1 || lip.bands > 1;
  const [splitOpen, setSplitOpen] = useState(false);
  // Show the grid when the user opts in, or when a loaded design already has
  // multiple zones (so its colors are visible/editable without re-opting in).
  const showGrid = splitOpen || isMultiCell;
  const cells = activeLipCells({ corners: lip.corners, bands: lip.bands });

  const handleToggleSplit = (checked: boolean) => {
    setSplitOpen(checked);
    if (!checked) {
      // Collapse to a single color. Cells persist (non-destructive), so
      // re-opening and raising a count restores the previous zone colors.
      if (lip.corners !== 1) onSetCorners(1);
      if (lip.bands !== 1) onSetBands(1);
    }
  };

  return (
    <div className="space-y-2">
      {showGrid && (
        <div className="flex items-center gap-3">
          <LipGridDiagram lip={lip} hovered={hovered} onHover={onHover} />
          <div className="flex flex-1 flex-col gap-1.5">
            {/* Not a <label>: it wraps a radiogroup, and a label leaks its text
                onto the group's first radio (e.g. "Corners Corners"). The span is
                the visible label; the SegmentedControl carries its own aria-label. */}
            <div className="flex items-center justify-between gap-2 text-[11px] text-content-secondary">
              <span>{t('binDesigner.colors.lip.cornersLabel')}</span>
              <SegmentedControl
                size="sm"
                aria-label={t('binDesigner.colors.lip.cornersLabel')}
                options={AXIS_OPTIONS}
                value={String(lip.corners)}
                onChange={(v) => onSetCorners(toAxis(v))}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-content-secondary">
              <span>{t('binDesigner.colors.lip.bandsLabel')}</span>
              <SegmentedControl
                size="sm"
                aria-label={t('binDesigner.colors.lip.bandsLabel')}
                options={AXIS_OPTIONS}
                value={String(lip.bands)}
                onChange={(v) => onSetBands(toAxis(v))}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Checkbox supplies its own <label htmlFor>; wrapping it in another
          <label> nests labels and makes the visually-hidden input the labeled
          control, which scrolls the panel to its bottom on click. */}
      <Checkbox
        size="sm"
        className="w-fit"
        checked={showGrid}
        onChange={handleToggleSplit}
        label={t('binDesigner.colors.lip.splitZones')}
      />
    </div>
  );
}
