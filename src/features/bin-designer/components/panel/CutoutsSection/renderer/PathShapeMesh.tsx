/**
 * WebGL mesh renderer for a path (pen tool) cutout shape.
 *
 * Renders a filled triangulated mesh with depth-shading gradient (matching
 * SDF shapes) and solid stroke outline. Position and rotation in world
 * coordinates (mm, Y-up).
 */

import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { flattenPath, getPathBounds, MIN_PATH_POINTS } from '../pathGeometry';
import { pathFillIndices } from './pathFill';
import { RENDER_ORDER } from './constants';
import { useShapePointerHandlers, useShapeColors, pickStrokeColor } from './shapeInteraction';
import { shapePosZ, shapeRenderOrder } from './zLayer';
import {
  outlineVertexShader as pathVertexShader,
  outlineFragmentShader as pathFragmentShader,
  bakeDistanceField,
  MIN_POLYLINE_POINTS,
} from './outlineShapeGeometry';

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
  const {
    isHovered,
    handlePointerDown,
    handleDoubleClick,
    handlePointerEnter,
    handlePointerLeave,
  } = useShapePointerHandlers({
    cutoutId: cutout.id,
    isSelected,
    disablePointerEvents,
    onSelect,
    onDragStart,
    onDoubleClick,
  });

  const path = cutout.path;

  // Flatten bezier path to polyline from the committed path (stable during drag)
  const flatPoints = useMemo(
    () => (path && path.length >= MIN_PATH_POINTS ? flattenPath(path) : []),
    [path]
  );

  // Cutout colors derived from the bin surface color
  const shapeColors = useShapeColors(binColor);
  const { cutFillColor } = shapeColors;

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
  const effectiveHoles = previewOverrides?.holes ?? cutout.holes;
  const flatHoles = useMemo(
    () =>
      (effectiveHoles ?? [])
        .map((hole) => flattenPath(hole))
        .filter((ring) => ring.length >= MIN_POLYLINE_POINTS),
    [effectiveHoles]
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

  // Build fill geometry (triangulated polygon mesh). Islands are left open,
  // so they read as material and a click there misses the cutout.
  const fillGeometry = useMemo(() => {
    const outline = effectiveFlatPoints;
    if (outline.length < MIN_POLYLINE_POINTS) return null;

    const pts = [outline, ...flatHoles].flat();
    const indices = pathFillIndices(outline, flatHoles);
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
  }, [effectiveFlatPoints, flatHoles, renderCenterX, renderCenterY]);

  // Dispose previous fill geometry on change
  useEffect(() => {
    return () => {
      fillGeometry?.dispose();
    };
  }, [fillGeometry]);

  // Bake distance field texture for depth shading
  const distField = useMemo(() => {
    if (effectiveFlatPoints.length < MIN_POLYLINE_POINTS) return null;
    return bakeDistanceField(effectiveFlatPoints, renderCenterX, renderCenterY, flatHoles);
  }, [effectiveFlatPoints, flatHoles, renderCenterX, renderCenterY]);

  // Dispose previous distance field texture on change
  useEffect(() => {
    return () => {
      distField?.texture.dispose();
    };
  }, [distField]);

  // Build stroke geometry: one closed loop for the outline and one per island
  const strokeGeometries = useMemo(() => {
    if (effectiveFlatPoints.length < MIN_POLYLINE_POINTS) return [];
    return [effectiveFlatPoints, ...flatHoles].map((ring) =>
      new THREE.BufferGeometry().setFromPoints(
        ring.map((p) => new THREE.Vector3(p.x - renderCenterX, p.y - renderCenterY, 0.02))
      )
    );
  }, [effectiveFlatPoints, flatHoles, renderCenterX, renderCenterY]);

  // Dispose previous stroke geometry on change
  useEffect(() => {
    return () => {
      for (const geometry of strokeGeometries) geometry.dispose();
    };
  }, [strokeGeometries]);

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
  const strokeColor = pickStrokeColor({ isSelected, isHovered, isGrouped }, shapeColors);
  const rotationZ = -(effective.rotation * Math.PI) / 180;
  const posZ = shapePosZ(cutout.zIndex, area);

  return (
    <group
      position={[groupX, groupY, posZ]}
      rotation={[0, 0, rotationZ]}
      renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
    >
      {/* Depth-shaded fill mesh */}
      {fillGeometry && fillMaterial && (
        <mesh
          geometry={fillGeometry}
          material={fillMaterial}
          renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        />
      )}

      {/* Solid stroke outline (matches rect/circle styling) — hidden during vertex editing */}
      {!disablePointerEvents &&
        strokeGeometries.map((geometry, i) => (
          <lineLoop
            key={i}
            geometry={geometry}
            renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES + 1, cutout.zIndex, area)}
          >
            <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
          </lineLoop>
        ))}
    </group>
  );
});
