/**
 * WebGL mesh renderer for a path (pen tool) cutout shape.
 *
 * Renders a filled triangulated mesh with depth-shading gradient (matching
 * SDF shapes) and solid stroke outline. Position and rotation in world
 * coordinates (mm, Y-up).
 */

import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { flattenPath, triangulatePath, getPathBounds, MIN_PATH_POINTS } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

/** Vertex shader passing local position for distance-field texture lookup */
const pathVertexShader = /* glsl */ `
  varying vec2 v_local;
  void main() {
    v_local = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Fragment shader sampling a baked distance-field texture for depth shading */
const pathFragmentShader = /* glsl */ `
  uniform vec3 u_fillColor;
  uniform float u_opacity;
  uniform sampler2D u_distField;
  uniform vec2 u_boundsMin;
  uniform vec2 u_boundsSize;

  varying vec2 v_local;

  void main() {
    // Map local position to UV in distance field texture
    vec2 uv = (v_local - u_boundsMin) / u_boundsSize;
    float edgeDist = texture2D(u_distField, uv).r;

    // Match SDF depth shading: edge darkest (0.55), center lighter (0.9)
    float shadow = mix(0.55, 0.9, smoothstep(0.0, 0.35, edgeDist));
    gl_FragColor = vec4(u_fillColor * shadow, u_opacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/** Resolution of the baked distance field texture (pixels per axis). */
const DF_RESOLUTION = 64;

/** Minimum flattened polyline points required to render fill/stroke (need 3 for triangulation). */
const MIN_POLYLINE_POINTS = 3;

/**
 * Bake a distance-field texture for a polygon.
 * Each texel stores normalized distance-to-boundary (0 = on edge, 1 = deep inside).
 * The texture covers the polygon's local bounding box (centered at render origin).
 */
function bakeDistanceField(
  polygon: readonly { x: number; y: number }[],
  centerX: number,
  centerY: number
): { texture: THREE.DataTexture; boundsMin: [number, number]; boundsSize: [number, number] } {
  // Compute local bounds (polygon coords relative to center)
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
  // Pad slightly to avoid edge artifacts
  const pad = 0.5;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const data = new Uint8Array(DF_RESOLUTION * DF_RESOLUTION);
  const n = polygon.length;

  // Find max possible distance for normalization
  const maxInner = Math.min(w, h) * 0.5;

  for (let row = 0; row < DF_RESOLUTION; row++) {
    for (let col = 0; col < DF_RESOLUTION; col++) {
      const px = minX + ((col + 0.5) / DF_RESOLUTION) * w;
      const py = minY + ((row + 0.5) / DF_RESOLUTION) * h;

      // Min distance to polygon boundary
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

      // Normalize: 0 at edge, 1 at maxInner distance inside
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

interface PathShapeMeshProps {
  readonly cutout: Cutout;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly isDragging: boolean;
  readonly previewOverrides?: Partial<Cutout>;
  readonly binColor: string;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  /** When true, pointer events pass through to the background (e.g. during vertex editing). */
  readonly disablePointerEvents?: boolean;
}

export const PathShapeMesh = memo(function PathShapeMesh({
  cutout,
  isSelected,
  isGrouped,
  isDragging,
  previewOverrides,
  binColor,
  onSelect,
  onDoubleClick,
  onDragStart,
  disablePointerEvents,
}: PathShapeMeshProps) {
  const [isHovered, setIsHovered] = useState(false);

  const path = cutout.path;

  // Flatten bezier path to polyline from the committed path (stable during drag)
  const flatPoints = useMemo(
    () => (path && path.length >= MIN_PATH_POINTS ? flattenPath(path) : []),
    [path]
  );

  // Cutout colors derived from the bin surface color
  const { cutFillColor, strokeDefault, strokeGrouped, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7), // darkened — bottom of cut
      strokeDefault: base.clone().multiplyScalar(0.5), // outline for contrast
      strokeGrouped: base.clone().multiplyScalar(0.35), // darker for grouped emphasis
      strokeHover: base.clone().multiplyScalar(0.4), // darker on hover
    };
  }, [binColor]);

  // Geometry center from committed path — stable reference for local coords
  const { geoCenterX, geoCenterY, area } = useMemo(() => {
    if (!path || path.length < MIN_PATH_POINTS) {
      return { geoCenterX: 0, geoCenterY: 0, area: 0 };
    }
    const bounds = getPathBounds(path);
    return {
      geoCenterX: (bounds.minX + bounds.maxX) / 2,
      geoCenterY: (bounds.minY + bounds.maxY) / 2,
      area: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY),
    };
  }, [path]);

  // During vertex editing, preview has updated path — rebuild geometry from that
  const effectivePath = previewOverrides?.path ?? path;
  const effectiveFlatPoints = useMemo(
    () =>
      effectivePath && effectivePath.length >= MIN_PATH_POINTS
        ? flattenPath(effectivePath)
        : flatPoints,
    [effectivePath, flatPoints]
  );

  // Effective center for geometry and positioning
  const { renderCenterX, renderCenterY } = useMemo(() => {
    if (effectivePath && effectivePath !== path && effectivePath.length >= MIN_PATH_POINTS) {
      const bounds = getPathBounds(effectivePath);
      return {
        renderCenterX: (bounds.minX + bounds.maxX) / 2,
        renderCenterY: (bounds.minY + bounds.maxY) / 2,
      };
    }
    return { renderCenterX: geoCenterX, renderCenterY: geoCenterY };
  }, [effectivePath, path, geoCenterX, geoCenterY]);

  // During drag, preview only has x/y — compute group position offset
  // Group position = geometry center + drag delta
  const groupX =
    previewOverrides?.x !== undefined
      ? renderCenterX + (previewOverrides.x - cutout.x)
      : renderCenterX;
  const groupY =
    previewOverrides?.y !== undefined
      ? renderCenterY + (previewOverrides.y - cutout.y)
      : renderCenterY;

  // Build fill geometry (triangulated polygon mesh)
  const fillGeometry = useMemo(() => {
    const pts = effectiveFlatPoints;
    if (pts.length < MIN_POLYLINE_POINTS) return null;

    const indices = triangulatePath(pts);
    if (indices.length === 0) return null;

    const positions = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i].x - renderCenterX;
      positions[i * 3 + 1] = pts[i].y - renderCenterY;
      positions[i * 3 + 2] = 0.02;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, [effectiveFlatPoints, renderCenterX, renderCenterY]);

  // Dispose previous fill geometry on change
  useEffect(() => {
    return () => {
      fillGeometry?.dispose();
    };
  }, [fillGeometry]);

  // Bake distance field texture for depth shading
  const distField = useMemo(() => {
    if (effectiveFlatPoints.length < MIN_POLYLINE_POINTS) return null;
    return bakeDistanceField(effectiveFlatPoints, renderCenterX, renderCenterY);
  }, [effectiveFlatPoints, renderCenterX, renderCenterY]);

  // Dispose previous distance field texture on change
  useEffect(() => {
    return () => {
      distField?.texture.dispose();
    };
  }, [distField]);

  // Build stroke geometry (closed loop outline)
  const strokeGeometry = useMemo(() => {
    const pts = effectiveFlatPoints;
    if (pts.length < MIN_POLYLINE_POINTS) return null;

    const loopPoints = pts.map(
      (p) => new THREE.Vector3(p.x - renderCenterX, p.y - renderCenterY, 0.02)
    );
    return new THREE.BufferGeometry().setFromPoints(loopPoints);
  }, [effectiveFlatPoints, renderCenterX, renderCenterY]);

  // Dispose previous stroke geometry on change
  useEffect(() => {
    return () => {
      strokeGeometry?.dispose();
    };
  }, [strokeGeometry]);

  // Depth-shaded fill material with distance field texture
  const fillMaterial = useMemo(() => {
    if (!distField) return null;
    return new THREE.ShaderMaterial({
      vertexShader: pathVertexShader,
      fragmentShader: pathFragmentShader,
      uniforms: {
        u_fillColor: { value: new THREE.Vector3(cutFillColor.r, cutFillColor.g, cutFillColor.b) },
        u_opacity: { value: isDragging ? 0.85 : 0.95 },
        u_distField: { value: distField.texture },
        u_boundsMin: { value: new THREE.Vector2(distField.boundsMin[0], distField.boundsMin[1]) },
        u_boundsSize: {
          value: new THREE.Vector2(distField.boundsSize[0], distField.boundsSize[1]),
        },
      },
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
  }, [cutFillColor, isDragging, distField]);

  if (!path || path.length < MIN_PATH_POINTS || effectiveFlatPoints.length < MIN_POLYLINE_POINTS)
    return null;

  const effective = previewOverrides ? { ...cutout, ...previewOverrides } : cutout;
  const strokeColor = isSelected
    ? STROKE_SELECTED
    : isHovered
      ? strokeHover
      : isGrouped
        ? strokeGrouped
        : strokeDefault;
  const rotationZ = -(effective.rotation * Math.PI) / 180;
  const posZ = 0.02 + 0.01 / Math.max(area, 1);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return;
    if (disablePointerEvents) return; // Let click fall through to background
    e.stopPropagation();
    const additive = e.nativeEvent.shiftKey;
    onSelect(cutout.id, additive);

    if (onDragStart && !additive) {
      onDragStart(cutout.id, e.point.x, e.point.y, e.nativeEvent.altKey);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (disablePointerEvents) return;
    e.stopPropagation();
    onDoubleClick?.(cutout.id);
  };

  const handlePointerEnter = () => {
    if (!isSelected) {
      setIsHovered(true);
    }
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
  };

  return (
    <group
      position={[groupX, groupY, posZ]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.SHAPES}
    >
      {/* Depth-shaded fill mesh */}
      {fillGeometry && fillMaterial && (
        <mesh
          geometry={fillGeometry}
          material={fillMaterial}
          renderOrder={RENDER_ORDER.SHAPES}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        />
      )}

      {/* Solid stroke outline (matches rect/circle styling) — hidden during vertex editing */}
      {strokeGeometry && !disablePointerEvents && (
        <lineLoop geometry={strokeGeometry} renderOrder={RENDER_ORDER.SHAPES + 1}>
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      )}
    </group>
  );
});
