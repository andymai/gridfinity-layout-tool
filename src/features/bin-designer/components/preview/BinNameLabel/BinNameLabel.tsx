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
 * Approximation — drei's SDF <Text> only exposes accurate widths via async onSync.
 */
function estimateTextWidth(charCount: number, fontSize: number): number {
  return charCount * fontSize * (CHAR_WIDTH_RATIO + LETTER_SPACING);
}

/**
 * Bin name label displayed on the floor in front of the bin.
 * Uppercase text centered on the bin's width.
 *
 * Long names shrink-to-fit on a single line down to MIN_FONT_SIZE; below that
 * threshold, font size resets to default and the text wraps to 2 lines.
 */
export function BinNameLabel({ width, depth, name }: BinNameLabelProps) {
  const colors = useThreeColors();
  if (!name.trim()) return null;

  const upperName = name.toUpperCase();
  const outerW = width * GRIDFINITY.GRID_SIZE;
  const halfD = (depth * GRIDFINITY.GRID_SIZE) / 2;
  const textY = -halfD - FRONT_OFFSET;

  const availableWidth = Math.max(outerW * 1.5, MIN_AVAILABLE_WIDTH);
  const defaultWidth = estimateTextWidth(upperName.length, DEFAULT_FONT_SIZE);

  let fontSize: number;
  let maxWidth: number;

  if (defaultWidth <= availableWidth) {
    fontSize = DEFAULT_FONT_SIZE;
    maxWidth = Infinity;
  } else {
    const idealFontSize = availableWidth / (upperName.length * (CHAR_WIDTH_RATIO + LETTER_SPACING));
    if (idealFontSize >= MIN_FONT_SIZE) {
      fontSize = idealFontSize;
      maxWidth = Infinity;
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
