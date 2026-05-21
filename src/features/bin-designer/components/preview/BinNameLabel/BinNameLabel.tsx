/**
 * Renders the bin design name on the floor in front of the bin,
 * matching the FrontLabel style from the layout planner's 3D preview.
 *
 * Positioned below the width dimension line for a technical drawing aesthetic.
 */

import { Text } from '@react-three/drei';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

interface BinNameLabelProps {
  /** Bin width in grid units (for centering) */
  width: number;
  /** Bin depth in grid units (for vertical positioning relative to bin edge) */
  depth: number;
  /** Grid unit size in mm (defaults to standard 42mm) */
  gridUnitMm?: number;
  /** Design name to display */
  name: string;
}

const TEXT_OPACITY = 0.6;
const DEFAULT_FONT_SIZE = 7; // mm (planner: 0.5 units)
const MIN_FONT_SIZE = 5; // mm — below this, wrap to 2 lines instead
const LETTER_SPACING = 0.08;
/** Distance from bin front edge to label center (mm) */
const FRONT_OFFSET = 32;
/** Minimum label width in mm — small bins still get room for reasonable names */
const MIN_AVAILABLE_WIDTH = 100;
/** Approximate ratio of uppercase character width to font size for drei's default SDF font */
const CHAR_WIDTH_RATIO = 0.6;

/**
 * Estimate rendered width of uppercase text at a given font size, accounting for letter spacing.
 * Letter spacing applies between glyphs (charCount - 1 gaps), not after each glyph.
 * Approximation — drei's SDF <Text> only exposes accurate widths via async onSync.
 */
function estimateTextWidth(charCount: number, fontSize: number): number {
  if (charCount <= 0) return 0;
  return fontSize * (charCount * CHAR_WIDTH_RATIO + (charCount - 1) * LETTER_SPACING);
}

/**
 * Bin name label displayed on the floor in front of the bin.
 * Uppercase text centered on the bin's width.
 *
 * Long names shrink-to-fit on a single line down to MIN_FONT_SIZE; below that
 * threshold, font size resets to default and the text wraps to 2 lines.
 */
export function BinNameLabel({ width, depth, gridUnitMm, name }: BinNameLabelProps) {
  const colors = useThreeColors();
  if (!name.trim()) return null;

  const upperName = name.toUpperCase();
  const GS = gridUnitMm ?? GRIDFINITY.GRID_SIZE;
  const outerW = width * GS;
  const halfD = (depth * GS) / 2;
  const textY = -halfD - FRONT_OFFSET;

  const availableWidth = Math.max(outerW * 1.5, MIN_AVAILABLE_WIDTH);
  const defaultWidth = estimateTextWidth(upperName.length, DEFAULT_FONT_SIZE);

  let fontSize: number;
  let maxWidth: number | undefined;

  if (defaultWidth <= availableWidth) {
    fontSize = DEFAULT_FONT_SIZE;
    maxWidth = undefined;
  } else {
    const idealFontSize = availableWidth / estimateTextWidth(upperName.length, 1);
    if (idealFontSize >= MIN_FONT_SIZE) {
      fontSize = idealFontSize;
      maxWidth = undefined;
    } else {
      fontSize = DEFAULT_FONT_SIZE;
      maxWidth = availableWidth;
    }
  }

  return (
    <Text
      position={[0, textY, 0.01]}
      fontSize={fontSize}
      color={colors.labelColor}
      fillOpacity={TEXT_OPACITY}
      anchorX="center"
      anchorY="middle"
      letterSpacing={LETTER_SPACING}
      maxWidth={maxWidth}
    >
      {upperName}
    </Text>
  );
}
