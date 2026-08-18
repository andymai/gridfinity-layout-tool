import { Text } from '@react-three/drei';
import { useTranslation } from '@/i18n';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

/** Neutral when the layout clears it, warning when something pokes through. */
const FITS_COLOR = '#22d3ee';
const OVERFLOW_COLOR = '#f59e0b';

interface CeilingPlaneProps {
  /** Measured internal drawer height, mm. */
  readonly ceilingMm: number;
  /** Scene X extent, in grid units. */
  readonly drawerWidth: number;
  /** Scene Y extent, already scaled for a non-square grid. */
  readonly scaledDepth: number;
  /** mm per grid unit — the scene's X/Y unit, and so its mm-to-world divisor. */
  readonly gridUnitMm: number;
  readonly fits: boolean;
}

/**
 * The measured drawer height, drawn as a plane the bins can visibly breach.
 *
 * Z comes from the measurement in mm rather than from `drawer.height`: the
 * stored unit count is that measurement floored to 0.01u, so a plane drawn from
 * it would sit below the real lid and contradict the text warnings. The scene's
 * X/Y unit is one grid unit, so mm divide by `gridUnitMm` — not by
 * `heightUnitMm`, which only scales unit-denominated heights.
 */
export function CeilingPlane({
  ceilingMm,
  drawerWidth,
  scaledDepth,
  gridUnitMm,
  fits,
}: CeilingPlaneProps) {
  const t = useTranslation();
  const colors = useThreeColors();
  const z = ceilingMm / gridUnitMm;
  const color = fits ? FITS_COLOR : OVERFLOW_COLOR;

  return (
    <group position={[drawerWidth / 2, scaledDepth / 2, z]}>
      <mesh>
        <planeGeometry args={[drawerWidth, scaledDepth]} />
        {/* depthWrite off so bins standing through it still render in front. */}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fits ? 0.06 : 0.14}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, scaledDepth / 2 + 0.35, 0.01]}
        fontSize={0.28}
        color={colors.labelColor}
        anchorX="center"
        anchorY="bottom"
      >
        {t('drawerCeiling.planeLabel')}
      </Text>
    </group>
  );
}
