import { useThreeColors } from '@/shared/hooks/useThemeEffect';

/** Three-point lighting matching the bin designer (must be inside Canvas). */
export function SceneLighting() {
  const colors = useThreeColors();
  return (
    <>
      <hemisphereLight args={['#ffffff', colors.groundBounce, 0.65]} />
      <directionalLight position={[-50, 60, 80]} intensity={0.85} color="#fff8f0" />
      <directionalLight position={[40, -40, 30]} intensity={0.15} color="#e0e8ff" />
    </>
  );
}
