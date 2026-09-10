import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { ACCENT_COLOR_HEX } from './constants';

export const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

export interface ShapeColors {
  readonly cutFillColor: THREE.Color;
  readonly strokeDefault: THREE.Color;
  readonly strokeGrouped: THREE.Color;
  readonly strokeHover: THREE.Color;
}

/** Fill and outline shades of one shape, all darkened from the bin's surface colour. */
export function useShapeColors(binColor: string): ShapeColors {
  return useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7),
      strokeDefault: base.clone().multiplyScalar(0.5),
      strokeGrouped: base.clone().multiplyScalar(0.35),
      strokeHover: base.clone().multiplyScalar(0.4),
    };
  }, [binColor]);
}

interface StrokeState {
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isGrouped: boolean;
}

export function pickStrokeColor(
  { isSelected, isHovered, isGrouped }: StrokeState,
  colors: ShapeColors
): THREE.Color {
  if (isSelected) return STROKE_SELECTED;
  if (isHovered) return colors.strokeHover;
  if (isGrouped) return colors.strokeGrouped;
  return colors.strokeDefault;
}

interface ShapePointerOptions {
  readonly cutoutId: string;
  readonly isSelected: boolean;
  readonly disablePointerEvents?: boolean;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
}

/** Selection, drag start, double-click and hover for one shape on the board. */
export function useShapePointerHandlers({
  cutoutId,
  isSelected,
  disablePointerEvents,
  onSelect,
  onDragStart,
  onDoubleClick,
}: ShapePointerOptions) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return;
    // Let the click fall through to the background while a tool owns picks.
    if (disablePointerEvents) return;
    e.stopPropagation();
    const additive = e.nativeEvent.shiftKey;
    onSelect(cutoutId, additive);
    if (onDragStart && !additive) {
      onDragStart(cutoutId, e.point.x, e.point.y, e.nativeEvent.altKey);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (disablePointerEvents) return;
    e.stopPropagation();
    onDoubleClick?.(cutoutId);
  };

  const handlePointerEnter = () => {
    if (!isSelected) setIsHovered(true);
  };

  const handlePointerLeave = () => setIsHovered(false);

  return {
    isHovered,
    handlePointerDown,
    handleDoubleClick,
    handlePointerEnter,
    handlePointerLeave,
  };
}
