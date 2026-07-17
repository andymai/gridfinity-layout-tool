/**
 * WebGL renderer for a mesh imprint cutout's silhouette footprint.
 *
 * Draws the imported tool's outline rings (stored on the MeshAsset, so no
 * mesh decode is needed) as a translucent fill + stroke. Shape-locked:
 * selectable, draggable, and rotatable like any cutout, but the outline
 * itself is derived from the mesh and never point-edited or resized.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

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
  const [isHovered, setIsHovered] = useState(false);
  const asset = useDesignerStore((s) =>
    cutout.meshId !== undefined ? s.params.meshAssets?.[cutout.meshId] : undefined
  );

  const { cutFillColor, strokeDefault, strokeGrouped, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7),
      strokeDefault: base.clone().multiplyScalar(0.5),
      strokeGrouped: base.clone().multiplyScalar(0.35),
      strokeHover: base.clone().multiplyScalar(0.4),
    };
  }, [binColor]);

  // Fill: one triangulated ShapeGeometry per outline ring, in a local frame
  // centered on the footprint (rings live in asset space [0..w]×[0..d]).
  const fillGeometry = useMemo(() => {
    if (!asset) return null;
    const cx = asset.sizeMm.x / 2;
    const cy = asset.sizeMm.y / 2;
    const shapes = asset.outlines
      .filter((ring) => ring.length >= 3)
      .map((ring) => {
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
  }, [asset]);

  useEffect(() => {
    return () => {
      fillGeometry?.dispose();
    };
  }, [fillGeometry]);

  const strokeGeometries = useMemo(() => {
    if (!asset) return [];
    const cx = asset.sizeMm.x / 2;
    const cy = asset.sizeMm.y / 2;
    return asset.outlines
      .filter((ring) => ring.length >= 3)
      .map((ring) =>
        new THREE.BufferGeometry().setFromPoints(
          ring.map((p) => new THREE.Vector3(p.x - cx, p.y - cy, 0.02))
        )
      );
  }, [asset]);

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

  const strokeColor = isSelected
    ? STROKE_SELECTED
    : isHovered
      ? strokeHover
      : isGrouped
        ? strokeGrouped
        : strokeDefault;

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
      position={[groupX, groupY, 0.02]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.SHAPES}
    >
      <mesh
        geometry={fillGeometry}
        renderOrder={RENDER_ORDER.SHAPES}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerEnter={() => {
          if (!isSelected) setIsHovered(true);
        }}
        onPointerLeave={() => setIsHovered(false)}
      >
        <meshBasicMaterial
          color={cutFillColor}
          transparent
          opacity={isDragging ? 0.5 : 0.65}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {strokeGeometries.map((geo, i) => (
        <lineLoop key={i} geometry={geo} renderOrder={RENDER_ORDER.SHAPES + 1}>
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      ))}
    </group>
  );
});
