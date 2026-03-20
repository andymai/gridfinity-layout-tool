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
  uniform vec3 colorMid;
  uniform vec3 colorBottom;
  varying vec2 vUv;
  void main() {
    float lower = smoothstep(0.0, 0.45, vUv.y);
    float upper = smoothstep(0.45, 1.0, vUv.y);
    vec3 color = mix(mix(colorBottom, colorMid, lower), colorTop, upper);
    gl_FragColor = vec4(color, 1.0);
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
        colorMid: { value: new THREE.Color(colors.gradientMid) },
        colorBottom: { value: new THREE.Color(colors.gradientBottom) },
      },
      depthWrite: false,
      depthTest: false,
    });
  }, [colors.gradientTop, colors.gradientMid, colors.gradientBottom]);

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
