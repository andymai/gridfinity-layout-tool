/**
 * Geometry utilities for the WebGL cutout renderer.
 *
 * Shapes are rendered using SDF fragment shaders on simple quad (plane) geometry.
 * This module provides helper functions for creating appropriately-sized quads.
 */

import * as THREE from 'three';

/** Vertex shader shared by all SDF shape materials */
export const sdfVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Fragment shader for SDF rounded-rect and ellipse shapes */
export const sdfFragmentShader = /* glsl */ `
  uniform vec2 u_size;
  uniform float u_cornerRadius;
  uniform vec4 u_fillColor;
  uniform vec4 u_strokeColor;
  uniform float u_strokeWidth;
  uniform int u_shapeType; // 0 = rounded rect, 1 = ellipse

  varying vec2 vUv;

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  float sdEllipse(vec2 p, vec2 ab) {
    vec2 q = p / ab;
    return (length(q) - 1.0) * min(ab.x, ab.y);
  }

  void main() {
    vec2 p = (vUv - 0.5) * u_size;
    float d;
    if (u_shapeType == 1) {
      d = sdEllipse(p, u_size * 0.5);
    } else {
      d = sdRoundedBox(p, u_size * 0.5, u_cornerRadius);
    }

    float aa = fwidth(d);
    float fill = 1.0 - smoothstep(-aa, aa, d);
    float strokeMask = 1.0 - smoothstep(-aa, aa, abs(d) - u_strokeWidth * 0.5);

    vec4 fillResult = u_fillColor * fill;
    gl_FragColor = mix(fillResult, u_strokeColor, strokeMask * u_strokeColor.a);

    // Discard fully transparent pixels for proper hit testing
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/** Create an SDF ShaderMaterial for cutout shapes */
export function createSDFMaterial(options: {
  width: number;
  depth: number;
  cornerRadius: number;
  shapeType: 0 | 1;
  fillColor: THREE.Vector4;
  strokeColor: THREE.Vector4;
  strokeWidth: number;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: sdfVertexShader,
    fragmentShader: sdfFragmentShader,
    uniforms: {
      u_size: { value: new THREE.Vector2(options.width, options.depth) },
      u_cornerRadius: { value: options.cornerRadius },
      u_fillColor: { value: options.fillColor },
      u_strokeColor: { value: options.strokeColor },
      u_strokeWidth: { value: options.strokeWidth },
      u_shapeType: { value: options.shapeType },
    },
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  });
}

/** Convert a CSS color string + opacity to a THREE.Vector4 */
export function cssColorToVec4(cssColor: string, opacity: number): THREE.Vector4 {
  const color = new THREE.Color(cssColor);
  return new THREE.Vector4(color.r, color.g, color.b, opacity);
}
