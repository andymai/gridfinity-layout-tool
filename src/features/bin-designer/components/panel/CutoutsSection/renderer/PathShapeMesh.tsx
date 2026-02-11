/**
 * WebGL mesh renderer for a path (pen tool) cutout shape.
 *
 * Renders a filled triangulated mesh with depth-shading gradient (matching
 * SDF shapes) and solid stroke outline. Position and rotation in world
 * coordinates (mm, Y-up).
 */

import { memo, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { flattenPath, triangulatePath, getPathBounds } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

/** Vertex shader passing per-vertex edge distance for depth shading */
const pathVertexShader = /* glsl */ `
  attribute float a_edgeDist;
  varying float v_edgeDist;
  void main() {
    v_edgeDist = a_edgeDist;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Fragment shader with depth-shading gradient matching SDF shapes */
const pathFragmentShader = /* glsl */ `
  uniform vec3 u_fillColor;
  uniform float u_opacity;
  uniform float u_maxDist;
  varying float v_edgeDist;

  void main() {
    // Normalize edge distance (0 = on edge, 1 = deep inside)
    float depthNorm = clamp(v_edgeDist / u_maxDist, 0.0, 1.0);
    // Match SDF depth shading: edge darkest (0.55), center lighter (0.9)
    float shadow = mix(0.55, 0.9, smoothstep(0.0, 0.35, depthNorm));
    gl_FragColor = vec4(u_fillColor * shadow, u_opacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/**
 * Compute minimum distance from a point to the polygon boundary.
 * Uses point-to-segment distance for each edge of the polygon.
 */
function distanceToPolygon(
  px: number,
  py: number,
  polygon: readonly { x: number; y: number }[]
): number {
  let minDist = Infinity;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const d = Math.hypot(px - a.x, py - a.y);
      if (d < minDist) minDist = d;
      continue;
    }
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const d = Math.hypot(px - projX, py - projY);
    if (d < minDist) minDist = d;
  }
  return minDist;
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
}: PathShapeMeshProps) {
  const [isHovered, setIsHovered] = useState(false);

  const path = cutout.path;

  // Flatten bezier path to polyline from the committed path (stable during drag)
  const flatPoints = useMemo(() => (path && path.length >= 3 ? flattenPath(path) : []), [path]);

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
    if (!path || path.length < 3) {
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
    () => (effectivePath && effectivePath.length >= 3 ? flattenPath(effectivePath) : flatPoints),
    [effectivePath, flatPoints]
  );

  // Effective center for geometry and positioning
  const { renderCenterX, renderCenterY } = useMemo(() => {
    if (effectivePath && effectivePath !== path && effectivePath.length >= 3) {
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

  // Build fill geometry with per-vertex edge distance for depth shading
  const { fillGeometry, maxEdgeDist } = useMemo(() => {
    const pts = effectiveFlatPoints;
    if (pts.length < 3) return { fillGeometry: null, maxEdgeDist: 1 };

    const indices = triangulatePath(pts);
    if (indices.length === 0) return { fillGeometry: null, maxEdgeDist: 1 };

    const positions = new Float32Array(pts.length * 3);
    const edgeDists = new Float32Array(pts.length);
    let maxDist = 0;

    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i].x - renderCenterX;
      positions[i * 3 + 1] = pts[i].y - renderCenterY;
      positions[i * 3 + 2] = 0.02;

      const dist = distanceToPolygon(pts[i].x, pts[i].y, pts);
      edgeDists[i] = dist;
      if (dist > maxDist) maxDist = dist;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('a_edgeDist', new THREE.BufferAttribute(edgeDists, 1));
    geo.setIndex(indices);
    return { fillGeometry: geo, maxEdgeDist: Math.max(maxDist, 0.1) };
  }, [effectiveFlatPoints, renderCenterX, renderCenterY]);

  // Build stroke geometry (closed loop outline)
  const strokeGeometry = useMemo(() => {
    const pts = effectiveFlatPoints;
    if (pts.length < 3) return null;

    const loopPoints = pts.map(
      (p) => new THREE.Vector3(p.x - renderCenterX, p.y - renderCenterY, 0.02)
    );
    return new THREE.BufferGeometry().setFromPoints(loopPoints);
  }, [effectiveFlatPoints, renderCenterX, renderCenterY]);

  // Depth-shaded fill material
  const fillMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pathVertexShader,
        fragmentShader: pathFragmentShader,
        uniforms: {
          u_fillColor: { value: new THREE.Vector3(cutFillColor.r, cutFillColor.g, cutFillColor.b) },
          u_opacity: { value: isDragging ? 0.85 : 0.95 },
          u_maxDist: { value: maxEdgeDist },
        },
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    [cutFillColor, isDragging, maxEdgeDist]
  );

  if (!path || path.length < 3 || effectiveFlatPoints.length < 3) return null;

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
    e.stopPropagation();
    const additive = e.nativeEvent.shiftKey;
    onSelect(cutout.id, additive);

    if (onDragStart && !additive) {
      onDragStart(cutout.id, e.point.x, e.point.y, e.nativeEvent.altKey);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
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
      {fillGeometry && (
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

      {/* Solid stroke outline (matches rect/circle styling) */}
      {strokeGeometry && (
        <lineLoop geometry={strokeGeometry} renderOrder={RENDER_ORDER.SHAPES + 1}>
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      )}
    </group>
  );
});
