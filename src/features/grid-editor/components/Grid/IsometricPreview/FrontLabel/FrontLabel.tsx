import { FittedFloorLabel } from '@/shared/components/preview/FittedFloorLabel';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

interface FrontLabelProps {
  drawerWidth: number;
  label: string;
}

const TEXT_OPACITY = 0.6;
const LINE_OPACITY = 0.25;
const FONT_SIZE = 0.5;
/** The same 5/7 shrink headroom the bin designer's label gets before it wraps. */
const MIN_FONT_SIZE = 0.36;
/** Distance from the last line down to the rule. */
const UNDERLINE_GAP = 0.45;
/**
 * Roughly 25 characters at the base size — the same budget the designer's
 * label has at 7mm in a 120mm band. Scene units are grid cells here, so a
 * typical drawer's proportional band already exceeds this.
 */
const MIN_BAND = 8.5;

/**
 * Renders the layout name along the front edge of the floor
 * with a subtle underline for technical drawing aesthetic.
 */
export function FrontLabel({ drawerWidth, label }: FrontLabelProps) {
  const colors = useThreeColors();

  return (
    <FittedFloorLabel
      text={label.toUpperCase()}
      band={Math.max(drawerWidth * 1.5, MIN_BAND)}
      baseFontSize={FONT_SIZE}
      minFontSize={MIN_FONT_SIZE}
      // Centered along the front edge, below the width dimension line (Y = -0.8 to -1.1).
      position={[drawerWidth / 2, -2.2, 0.01]}
      color={colors.labelColor}
      fillOpacity={TEXT_OPACITY}
      letterSpacing={0.08}
      underline={{ gap: UNDERLINE_GAP, opacity: LINE_OPACITY }}
    />
  );
}
