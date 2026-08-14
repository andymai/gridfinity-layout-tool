/**
 * Renders the bin design name on the floor in front of the bin,
 * matching the FrontLabel style from the layout planner's 3D preview.
 *
 * Positioned below the width dimension line for a technical drawing aesthetic.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { FittedFloorLabel } from './FittedFloorLabel';

interface BinNameLabelProps {
  /** Bin width in grid units (for centering) */
  width: number;
  /** Bin depth in grid units (for vertical positioning relative to bin edge) */
  depth: number;
  /** Grid unit size in mm along X / width (defaults to standard 42mm) */
  gridUnitMm?: number;
  /** Optional grid unit size in mm along Y / depth (non-square grid); defaults to gridUnitMm */
  gridUnitMmY?: number;
  /** Design name to display */
  name: string;
}

const TEXT_OPACITY = 0.6;
const FONT_SIZE = 7; // mm (planner: 0.5 units)
const MIN_FONT_SIZE = 5; // mm — below this, wrap rather than shrink further
const LETTER_SPACING = 0.08;
/** Distance from bin front edge to the first line's centre (mm) */
const FRONT_OFFSET = 32;
/**
 * A 1x1 bin's proportional band is only 63mm, far narrower than the floor
 * plane and camera framing allow. Small bins overhang their own footprint
 * rather than shrinking a short name to nothing.
 */
const MIN_BAND_MM = 120;

/**
 * Bin name label displayed on the floor in front of the bin.
 * Uppercase text centered on the bin's width.
 */
export function BinNameLabel({ width, depth, gridUnitMm, gridUnitMmY, name }: BinNameLabelProps) {
  const colors = useThreeColors();
  if (!name.trim()) return null;

  const GS = gridUnitMm ?? GRIDFINITY.GRID_SIZE;
  const GSY = gridUnitMmY ?? GS;
  const outerW = width * GS;
  const halfD = (depth * GSY) / 2;

  return (
    <FittedFloorLabel
      text={name.toUpperCase()}
      band={Math.max(outerW * 1.5, MIN_BAND_MM)}
      baseFontSize={FONT_SIZE}
      minFontSize={MIN_FONT_SIZE}
      position={[0, -halfD - FRONT_OFFSET, 0.01]}
      color={colors.labelColor}
      fillOpacity={TEXT_OPACITY}
      letterSpacing={LETTER_SPACING}
    />
  );
}
