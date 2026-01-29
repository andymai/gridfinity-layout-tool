/**
 * Banana for scale — real-world size reference in the 3D preview.
 *
 * Banana model by Poly by Google, CC-BY 4.0, via get3dmodels.com
 */
import { useGLTF, Text, Clone } from '@react-three/drei';
import { useTranslation } from '@/i18n';

const TEXT_COLOR = '#ffffff';
const TEXT_OPACITY = 0.6;
const FONT_SIZE = 0.25;

/** Real banana length in mm */
const BANANA_LENGTH_MM = 200;

/**
 * Raw model extent along its longest axis (Y: -42 to +56 ≈ 98 units).
 * Measured from the GLB accessor min/max bounds.
 */
const RAW_MODEL_LENGTH = 98;

interface BananaScaleProps {
  drawerDepth: number;
  gridUnitMm: number;
}

export function BananaScale({ drawerDepth, gridUnitMm }: BananaScaleProps) {
  const t = useTranslation();
  const { scene } = useGLTF('/models/banana.glb');

  // Target length in grid-unit space
  const bananaGridUnits = BANANA_LENGTH_MM / gridUnitMm;

  // Scale factor: desired grid-unit length / raw model length
  const scaleFactor = bananaGridUnits / RAW_MODEL_LENGTH;

  // Raw model Y center is ~7 units (midpoint of -42 to +56).
  // Offset so the banana is centered at Y=0 within the inner group.
  const rawCenterY = 7;
  const yOffset = -rawCenterY * scaleFactor;

  // Position to the left of the grid, centered along the depth axis.
  const x = -3;
  const z = 0;

  return (
    <group position={[x, drawerDepth / 2, z]}>
      <Clone object={scene} scale={scaleFactor} position={[0, yOffset, 0]} />
      {/* Label running alongside the banana's length (offset in X, centered in Y) */}
      <Text
        position={[1.2, 0, 0]}
        fontSize={FONT_SIZE}
        color={TEXT_COLOR}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        {t('grid.bananaLabel')}
      </Text>
    </group>
  );
}

useGLTF.preload('/models/banana.glb');
