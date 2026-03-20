/**
 * Gradient background for the 3D preview scene.
 * Renders a full-screen quad behind all scene content with a subtle vertical gradient.
 * Uses a custom shader material for GPU-efficient rendering.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 colorTop;
  uniform vec3 colorBottom;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
  }
`;

/**
 * Full-screen gradient background rendered behind the 3D scene.
 * Uses a screen-space quad with a custom shader for a studio photography feel.
 */
export function GradientBackground() {
  const colors = useThreeColors();

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        colorTop: { value: new THREE.Color(colors.gradientTop) },
        colorBottom: { value: new THREE.Color(colors.gradientBottom) },
      },
      depthWrite: false,
      depthTest: false,
    });
  }, [colors.gradientTop, colors.gradientBottom]);

  // Dispose shader material on unmount or when recreated
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh renderOrder={-1} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
