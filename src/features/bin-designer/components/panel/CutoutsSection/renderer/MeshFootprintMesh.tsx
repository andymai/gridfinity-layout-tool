/**
 * WebGL renderer for a mesh imprint cutout's silhouette footprint.
 *
 * Draws the imported tool's outline rings (stored with the mesh, so no mesh
 * decode is needed) as a translucent fill + stroke. Shape-locked: selectable,
 * draggable, and rotatable like any cutout, but the outline itself is derived
 * from the mesh and never point-edited or resized.
 *
 * A mesh whose file has not reached this device yet draws its footprint box,
 * faded, so the pocket reads as pending and stays selectable.
 */

import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useMeshAssetOutlines } from '@/shared/hooks/useMeshOutlines';
import { RENDER_ORDER } from './constants';
import { useShapePointerHandlers, useShapeColors, pickStrokeColor } from './shapeInteraction';
import { shapePosZ, shapeRenderOrder } from './zLayer';

interface MeshFootprintMeshProps {
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

export const MeshFootprintMesh = memo(function MeshFootprintMesh({
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
}: MeshFootprintMeshProps) {
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
  const asset = useDesignerStore((s) =>
    cutout.meshId !== undefined ? s.params.meshAssets?.[cutout.meshId] : undefined
  );
  const outlines = useMeshAssetOutlines(asset);
  const pending = asset !== undefined && outlines === undefined;

  const shapeColors = useShapeColors(binColor);
  const { cutFillColor } = shapeColors;

  const rings = useMemo(() => {
    if (!asset) return [];
    if (outlines) return outlines.filter((ring) => ring.length >= 3);
    const { x, y } = asset.sizeMm;
    return [
      [
        { x: 0, y: 0 },
        { x, y: 0 },
        { x, y },
        { x: 0, y },
      ],
    ];
  }, [asset, outlines]);

  // Fill: one triangulated ShapeGeometry per outline ring, in a local frame
  // centered on the footprint (rings live in asset space [0..w]×[0..d]).
  const fillGeometry = useMemo(() => {
    if (!asset) return null;
    const cx = asset.sizeMm.x / 2;
    const cy = asset.sizeMm.y / 2;
    const shapes = rings.map((ring) => {
      const shape = new THREE.Shape();
      ring.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x - cx, p.y - cy);
        else shape.lineTo(p.x - cx, p.y - cy);
      });
      shape.closePath();
      return shape;
    });
    if (shapes.length === 0) return null;
    return new THREE.ShapeGeometry(shapes);
  }, [asset, rings]);

  useEffect(() => {
    return () => {
      fillGeometry?.dispose();
    };
  }, [fillGeometry]);

  const strokeGeometries = useMemo(() => {
    if (!asset) return [];
    const cx = asset.sizeMm.x / 2;
    const cy = asset.sizeMm.y / 2;
    return rings.map((ring) =>
      new THREE.BufferGeometry().setFromPoints(
        ring.map((p) => new THREE.Vector3(p.x - cx, p.y - cy, 0.02))
      )
    );
  }, [asset, rings]);

  useEffect(() => {
    return () => {
      for (const geo of strokeGeometries) geo.dispose();
    };
  }, [strokeGeometries]);

  if (!asset || !fillGeometry) return null;

  const effective = previewOverrides ? { ...cutout, ...previewOverrides } : cutout;
  const groupX = effective.x + effective.width / 2;
  const groupY = effective.y + effective.depth / 2;
  const rotationZ = -(effective.rotation * Math.PI) / 180;
  // Same key as the other renderers so a footprint takes part in the
  // smaller-shape-wins tiebreaker instead of pinning to its layer floor.
  const area = effective.width * effective.depth;

  const strokeColor = pickStrokeColor({ isSelected, isHovered, isGrouped }, shapeColors);

  return (
    <group
      position={[groupX, groupY, shapePosZ(cutout.zIndex, area)]}
      rotation={[0, 0, rotationZ]}
      renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
    >
      <mesh
        geometry={fillGeometry}
        renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <meshBasicMaterial
          color={cutFillColor}
          transparent
          opacity={pending ? 0.25 : isDragging ? 0.5 : 0.65}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {strokeGeometries.map((geo, i) => (
        <lineLoop
          key={i}
          geometry={geo}
          renderOrder={shapeRenderOrder(
            RENDER_ORDER.SHAPES + 1,
            cutout.zIndex,
            Number.POSITIVE_INFINITY
          )}
        >
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      ))}
    </group>
  );
});
