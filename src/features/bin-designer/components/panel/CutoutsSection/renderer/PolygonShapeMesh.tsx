/**
 * WebGL mesh renderer for a regular-polygon (hex/n-gon) cutout.
 *
 * Vertices are derived from `sides` + the `width × depth` box (no stored path),
 * then rendered with the same distance-field depth shading + stroke as pen-tool
 * paths via the shared `outlineShapeGeometry` helpers.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES } from '@/features/bin-designer/types';
import { regularPolygonPoints, clampPolygonSides } from '@/shared/utils/cutoutPolygon';
import { triangulatePath } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';
import {
  outlineVertexShader,
  outlineFragmentShader,
  bakeDistanceField,
  MIN_POLYLINE_POINTS,
} from './outlineShapeGeometry';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

interface PolygonShapeMeshProps {
  readonly cutout: Cutout;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly isDragging: boolean;
  readonly previewOverrides?: Partial<Cutout>;
  readonly binColor: string;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly disablePointerEvents?: boolean;
}

export const PolygonShapeMesh = memo(function PolygonShapeMesh({
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
}: PolygonShapeMeshProps) {
  const [isHovered, setIsHovered] = useState(false);

  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  // Local-space (origin-centered) vertices — these depend only on the polygon's
  // sides + box, NOT its x/y, so the distance field + geometry are not re-baked
  // when the cutout is merely translated. The group position places it in world.
  const points = useMemo(
    () =>
      regularPolygonPoints(
        clampPolygonSides(effective.sides ?? DEFAULT_POLYGON_SIDES),
        effective.width,
        effective.depth
      ),
    [effective.sides, effective.width, effective.depth]
  );
  const centerX = effective.x + effective.width / 2;
  const centerY = effective.y + effective.depth / 2;
  const area = effective.width * effective.depth;

  const { cutFillColor, strokeDefault, strokeGrouped, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7),
      strokeDefault: base.clone().multiplyScalar(0.5),
      strokeGrouped: base.clone().multiplyScalar(0.35),
      strokeHover: base.clone().multiplyScalar(0.4),
    };
  }, [binColor]);

  const fillGeometry = useMemo(() => {
    if (points.length < MIN_POLYLINE_POINTS) return null;
    const indices = triangulatePath(points);
    if (indices.length === 0) return null;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = 0.02;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, [points]);

  useEffect(() => () => fillGeometry?.dispose(), [fillGeometry]);

  const distField = useMemo(() => {
    if (points.length < MIN_POLYLINE_POINTS) return null;
    return bakeDistanceField(points, 0, 0);
  }, [points]);

  useEffect(() => () => distField?.texture.dispose(), [distField]);

  const strokeGeometry = useMemo(() => {
    if (points.length < MIN_POLYLINE_POINTS) return null;
    const loop = points.map((p) => new THREE.Vector3(p.x, p.y, 0.02));
    return new THREE.BufferGeometry().setFromPoints(loop);
  }, [points]);

  useEffect(() => () => strokeGeometry?.dispose(), [strokeGeometry]);

  // Keyed only on the distance field (i.e. geometry) so dragging doesn't
  // recompile the shader; the color/opacity uniforms are updated in-place
  // below, mirroring SDFShapeMesh.
  const fillMaterial = useMemo(() => {
    if (!distField) return null;
    return new THREE.ShaderMaterial({
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      uniforms: {
        u_fillColor: { value: new THREE.Vector3() },
        u_opacity: { value: 0.95 },
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
  }, [distField]);

  useEffect(() => {
    if (!fillMaterial) return;
    const u = fillMaterial.uniforms;
    (u.u_fillColor.value as THREE.Vector3).set(cutFillColor.r, cutFillColor.g, cutFillColor.b);
    u.u_opacity.value = isDragging ? 0.85 : 0.95;
  }, [fillMaterial, cutFillColor, isDragging]);

  useEffect(() => () => fillMaterial?.dispose(), [fillMaterial]);

  if (points.length < MIN_POLYLINE_POINTS) return null;

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
    if (disablePointerEvents) return;
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

  return (
    <group
      position={[centerX, centerY, posZ]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.SHAPES}
    >
      {fillGeometry && fillMaterial && (
        <mesh
          geometry={fillGeometry}
          material={fillMaterial}
          renderOrder={RENDER_ORDER.SHAPES}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerEnter={() => !isSelected && setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
        />
      )}
      {strokeGeometry && (
        <lineLoop geometry={strokeGeometry} renderOrder={RENDER_ORDER.SHAPES + 1}>
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      )}
    </group>
  );
});
