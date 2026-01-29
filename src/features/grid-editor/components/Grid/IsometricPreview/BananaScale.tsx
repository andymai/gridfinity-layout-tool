/**
 * Banana for scale — real-world size reference in the 3D preview.
 *
 * Banana model by Poly by Google, CC-BY 4.0, via get3dmodels.com
 */
import { useGLTF, Text } from '@react-three/drei';
import { useTranslation } from '@/i18n';

const TEXT_COLOR = '#ffffff';
const TEXT_OPACITY = 0.6;
const FONT_SIZE = 0.25;

/** Real banana length in mm */
const BANANA_LENGTH_MM = 200;

interface BananaScaleProps {
  drawerWidth: number;
  gridUnitMm: number;
}

export function BananaScale({ drawerWidth, gridUnitMm }: BananaScaleProps) {
  const t = useTranslation();
  const { scene } = useGLTF('/models/banana.glb');

  // The raw model is roughly 1 unit long.
  // Scale so it represents ~200mm in the scene's grid-unit coordinate system.
  const bananaGridUnits = BANANA_LENGTH_MM / gridUnitMm;

  // Position next to the drawer's front-right corner
  const x = drawerWidth + 0.8;
  const y = -0.5;
  const z = 0;

  return (
    <group position={[x, y, z]}>
      <primitive
        object={scene.clone()}
        scale={[bananaGridUnits, bananaGridUnits, bananaGridUnits]}
        rotation={[Math.PI / 2, 0, -Math.PI / 4]}
      />
      <Text
        position={[bananaGridUnits / 2, -0.5, 0]}
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
