/**
 * Renders the bin design name on the floor in front of the bin,
 * matching the FrontLabel style from the layout planner's 3D preview.
 *
 * Positioned below the width dimension line for a technical drawing aesthetic.
 */

import { Text } from '@react-three/drei';
import { GRIDFINITY } from '@/shared/constants/bin';
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
const FONT_SIZE = 7; // mm (planner: 0.5 units)
const LETTER_SPACING = 0.08;
/** Distance from bin front edge to label center (mm) */
const FRONT_OFFSET = 32;

/**
 * Bin name label displayed on the floor in front of the bin.
 * Uppercase text centered on the bin's width.
 */
export function BinNameLabel({ width, depth, name }: BinNameLabelProps) {
  const colors = useThreeColors();
  if (!name.trim()) return null;

  const outerW = width * GRIDFINITY.GRID_SIZE;
  const halfD = (depth * GRIDFINITY.GRID_SIZE) / 2;

  const textY = -halfD - FRONT_OFFSET;

  return (
    <Text
      position={[0, textY, 0.01]}
      fontSize={FONT_SIZE}
      color={colors.labelColor}
      fillOpacity={TEXT_OPACITY}
      anchorX="center"
      anchorY="middle"
      letterSpacing={LETTER_SPACING}
      maxWidth={outerW * 1.5}
    >
      {name.toUpperCase()}
    </Text>
  );
}
