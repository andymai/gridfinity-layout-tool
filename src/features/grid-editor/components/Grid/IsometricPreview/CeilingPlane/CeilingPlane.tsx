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
  /**
   * Scene Y extent in RAW grid units. This component renders inside the
   * scene's depth-scaled group, which applies the non-square factor once —
   * pre-scaling the value here would apply it twice and squash the plane.
   */
  readonly drawerDepth: number;
  /**
   * The scene group's depth scale (`gridUnitMmY / gridUnitMm`, 1 for a square
   * grid). The mesh inherits it by design; the label counter-scales so its
   * glyphs keep their aspect, per the scene's annotation rule.
   */
  readonly depthScale: number;
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
  drawerDepth,
  depthScale,
  gridUnitMm,
  fits,
}: CeilingPlaneProps) {
  const t = useTranslation();
  const colors = useThreeColors();
  const z = ceilingMm / gridUnitMm;
  const color = fits ? FITS_COLOR : OVERFLOW_COLOR;

  return (
    <group position={[drawerWidth / 2, drawerDepth / 2, z]}>
      <mesh>
        <planeGeometry args={[drawerWidth, drawerDepth]} />
        {/* depthWrite off so bins standing through it still render in front. */}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fits ? 0.06 : 0.14}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, drawerDepth / 2 + 0.35 / depthScale, 0.01]}
        scale={[1, 1 / depthScale, 1]}
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
