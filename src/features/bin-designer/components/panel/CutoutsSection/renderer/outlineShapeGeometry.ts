/**
 * Shared GPU helpers for filled-polygon cutout renderers (pen-tool paths and
 * regular polygons). Both bake a distance-field texture for the same concave
 * depth-shading the SDF rect/circle shapes use, so every cutout looks alike.
 */

import * as THREE from 'three';

/** Vertex shader passing local position for distance-field texture lookup. */
export const outlineVertexShader = /* glsl */ `
  varying vec2 v_local;
  void main() {
    v_local = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Fragment shader sampling a baked distance-field texture for depth shading. */
export const outlineFragmentShader = /* glsl */ `
  uniform vec3 u_fillColor;
  uniform float u_opacity;
  uniform sampler2D u_distField;
  uniform vec2 u_boundsMin;
  uniform vec2 u_boundsSize;

  varying vec2 v_local;

  void main() {
    vec2 uv = (v_local - u_boundsMin) / u_boundsSize;
    float edgeDist = texture2D(u_distField, uv).r;
    float shadow = mix(0.55, 0.9, smoothstep(0.0, 0.35, edgeDist));
    gl_FragColor = vec4(u_fillColor * shadow, u_opacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/** Resolution of the baked distance-field texture (pixels per axis). */
export const DF_RESOLUTION = 64;

/** Minimum flattened points required to render fill/stroke (need 3 to triangulate). */
export const MIN_POLYLINE_POINTS = 3;

/**
 * Bake a distance-field texture for a polygon. Each texel stores normalized
 * distance-to-boundary (0 = on edge, 1 = deep inside). The texture covers the
 * polygon's local bounding box (centered at render origin).
 */
export function bakeDistanceField(
  polygon: readonly { x: number; y: number }[],
  centerX: number,
  centerY: number
): { texture: THREE.DataTexture; boundsMin: [number, number]; boundsSize: [number, number] } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polygon) {
    const lx = p.x - centerX;
    const ly = p.y - centerY;
    if (lx < minX) minX = lx;
    if (ly < minY) minY = ly;
    if (lx > maxX) maxX = lx;
    if (ly > maxY) maxY = ly;
  }
  const pad = 0.5;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const data = new Uint8Array(DF_RESOLUTION * DF_RESOLUTION);
  const n = polygon.length;
  const maxInner = Math.min(w, h) * 0.5;

  for (let row = 0; row < DF_RESOLUTION; row++) {
    for (let col = 0; col < DF_RESOLUTION; col++) {
      const px = minX + ((col + 0.5) / DF_RESOLUTION) * w;
      const py = minY + ((row + 0.5) / DF_RESOLUTION) * h;

      let dist = Infinity;
      for (let i = 0; i < n; i++) {
        const ax = polygon[i].x - centerX;
        const ay = polygon[i].y - centerY;
        const bx = polygon[(i + 1) % n].x - centerX;
        const by = polygon[(i + 1) % n].y - centerY;
        const dx = bx - ax,
          dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let d: number;
        if (lenSq === 0) {
          d = Math.hypot(px - ax, py - ay);
        } else {
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
          d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        }
        if (d < dist) dist = d;
      }

      const norm = Math.min(dist / maxInner, 1);
      data[row * DF_RESOLUTION + col] = Math.round(norm * 255);
    }
  }

  const tex = new THREE.DataTexture(data, DF_RESOLUTION, DF_RESOLUTION, THREE.RedFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  return { texture: tex, boundsMin: [minX, minY], boundsSize: [w, h] };
}
