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
  drawerWidth: number;
  gridUnitMm: number;
}

export function BananaScale({ drawerWidth, gridUnitMm }: BananaScaleProps) {
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

  // Position beside the drawer's front-right corner, lying on the floor.
  const x = drawerWidth + 1.5;
  const z = 0;

  // Label at the bottom end of the banana (negative Y side)
  const labelY = -(bananaGridUnits / 2) - 0.3;

  return (
    <group position={[x, 0, z]}>
      <Clone object={scene} scale={scaleFactor} position={[0, yOffset, 0]} />
      <Text
        position={[0, labelY, 0]}
        fontSize={FONT_SIZE}
        color={TEXT_COLOR}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="top"
      >
        {t('grid.bananaLabel')}
      </Text>
    </group>
  );
}

useGLTF.preload('/models/banana.glb');
