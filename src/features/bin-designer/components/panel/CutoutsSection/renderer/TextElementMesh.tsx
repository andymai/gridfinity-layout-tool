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

import { memo, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';
import { shapePosZ, shapeRenderOrder } from './zLayer';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

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
  const [isHovered, setIsHovered] = useState(false);

  const { strokeDefault, strokeGrouped, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      strokeDefault: base.clone().multiplyScalar(0.5),
      strokeGrouped: base.clone().multiplyScalar(0.35),
      strokeHover: base.clone().multiplyScalar(0.4),
    };
  }, [binColor]);

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

  const isEmpty = cutout.label.trim() === '';
  const showFrame = isSelected || isHovered || isGrouped || isEmpty;
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
      position={[groupX, groupY, shapePosZ(cutout.zIndex, area)]}
      rotation={[0, 0, rotationZ]}
      renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
    >
      <mesh
        renderOrder={shapeRenderOrder(RENDER_ORDER.SHAPES, cutout.zIndex, area)}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerEnter={() => {
          if (!isSelected) setIsHovered(true);
        }}
        onPointerLeave={() => setIsHovered(false)}
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
