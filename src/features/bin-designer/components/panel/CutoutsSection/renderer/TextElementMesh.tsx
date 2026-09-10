/**
 * WebGL renderer for a text element's footprint.
 *
 * The caption itself is drawn by `CutoutLabel3D` (a text element is an
 * engraved label whose anchor is its own box), so this renders only what makes
 * the element a first-class shape on the canvas: an invisible hit plane for
 * click/drag, and a frame that appears on hover, selection, grouping — or
 * whenever the caption is blank, without which an empty element would be
 * impossible to find again.
 */

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { RENDER_ORDER } from './constants';
import { useShapePointerHandlers, useShapeColors, pickStrokeColor } from './shapeInteraction';
import { shapePosZ, shapeRenderOrder } from './zLayer';

interface TextElementMeshProps {
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

export const TextElementMesh = memo(function TextElementMesh({
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
}: TextElementMeshProps) {
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

  const shapeColors = useShapeColors(binColor);

  const effective = previewOverrides ? { ...cutout, ...previewOverrides } : cutout;
  const groupX = effective.x + effective.width / 2;
  const groupY = effective.y + effective.depth / 2;
  const rotationZ = -(effective.rotation * Math.PI) / 180;
  const area = effective.width * effective.depth;

  const frameGeometry = useMemo(() => {
    const hw = effective.width / 2;
    const hd = effective.depth / 2;
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, -hd, 0.02),
      new THREE.Vector3(hw, -hd, 0.02),
      new THREE.Vector3(hw, hd, 0.02),
      new THREE.Vector3(-hw, hd, 0.02),
    ]);
  }, [effective.width, effective.depth]);

  const isEmpty = effective.label.trim() === '';
  const showFrame = isSelected || isHovered || isGrouped || isEmpty;
  const strokeColor = pickStrokeColor({ isSelected, isHovered, isGrouped }, shapeColors);

  return (
    <group
      position={[groupX, groupY, shapePosZ(cutout.zIndex, area)]}
      rotation={[0, 0, rotationZ]}
      renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
    >
      <mesh
        renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[effective.width, effective.depth]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
      {showFrame && (
        <lineLoop
          geometry={frameGeometry}
          renderOrder={shapeRenderOrder(
            RENDER_ORDER.SHAPES + 1,
            cutout.zIndex,
            Number.POSITIVE_INFINITY
          )}
        >
          <lineBasicMaterial
            color={strokeColor}
            transparent
            opacity={isDragging ? 0.5 : 1}
            depthTest={false}
          />
        </lineLoop>
      )}
    </group>
  );
});
