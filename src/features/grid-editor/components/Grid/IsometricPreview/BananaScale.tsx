/**
 * Banana for scale — real-world size reference in the 3D preview.
 *
 * Banana model by Poly by Google, CC-BY 4.0, via get3dmodels.com
 */
import { useMemo } from 'react';
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

  // Position next to the drawer's front-right corner.
  // The raw model center is ~Y=7 units, so after scaling the center shifts.
  // Place the group so the banana sits on the floor (z=0) beside the drawer.
  const x = drawerWidth + 1.5;
  const y = 0;
  const z = 0;

  // Rotation to lay the banana on its side along the X axis in the scene's
  // coordinate system (scene uses Z-up, model uses Y-up with length along Y).
  const rotation = useMemo<[number, number, number]>(() => [Math.PI / 2, 0, Math.PI / 2], []);

  return (
    <group position={[x, y, z]}>
      <Clone object={scene} scale={scaleFactor} rotation={rotation} />
      <Text
        position={[0, -0.6, 0]}
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
