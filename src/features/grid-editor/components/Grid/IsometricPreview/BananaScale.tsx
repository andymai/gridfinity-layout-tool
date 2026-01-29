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

  // Position next to the drawer's front-right corner, standing on the floor.
  // Raw model Y center is ~7 units; after rotation that becomes Z offset.
  // Shift down so the base sits at z=0.
  const x = drawerWidth + 1.5;
  const y = 0;
  const z = 42 * scaleFactor; // offset to ground the base (~raw Y min at -42)

  // Stand the banana upright: model is Y-up with length along Y,
  // scene is Z-up, so rotate 90° around X to point the length along Z.
  const rotation = useMemo<[number, number, number]>(() => [Math.PI / 2, 0, 0], []);

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
