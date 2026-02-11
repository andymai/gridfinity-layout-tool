/**
 * WebGL mesh renderer for a path (pen tool) cutout shape.
 *
 * Renders a filled triangulated mesh with stroke outline from flattened
 * bezier path data. Position and rotation in world coordinates (mm, Y-up).
 */

import { memo, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { flattenPath, triangulatePath, getPathBounds } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const STROKE_SELECTED = new THREE.Color(ACCENT_COLOR_HEX);

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
  isGrouped: _isGrouped,
  isDragging,
  previewOverrides,
  binColor,
  onSelect,
  onDoubleClick,
  onDragStart,
}: PathShapeMeshProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { camera } = useThree();
  const zoom = camera.zoom;

  // Merge preview overrides for live feedback during drag/resize
  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  const path = effective.path;

  // Flatten bezier path to polyline (stable empty array when path is missing)
  const flatPoints = useMemo(() => (path && path.length >= 3 ? flattenPath(path) : []), [path]);

  // Cutout colors derived from the bin surface color
  const { cutFillColor, strokeDefault, strokeHover } = useMemo(() => {
    const base = new THREE.Color(binColor);
    return {
      cutFillColor: base.clone().multiplyScalar(0.7), // darkened -- bottom of cut
      strokeDefault: base.clone().multiplyScalar(0.5), // outline for contrast
      strokeHover: base.clone().multiplyScalar(0.4), // darker on hover
    };
  }, [binColor]);

  const { centerX, centerY, area } = useMemo(() => {
    if (!path || path.length < 3) {
      return { centerX: 0, centerY: 0, area: 0 };
    }
    const bounds = getPathBounds(path);
    return {
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
      area: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY),
    };
  }, [path]);

  // Build fill geometry from triangulated path
  const fillGeometry = useMemo(() => {
    if (flatPoints.length < 3) return null;

    const indices = triangulatePath(flatPoints);
    if (indices.length === 0) return null;

    const positions = new Float32Array(flatPoints.length * 3);
    for (let i = 0; i < flatPoints.length; i++) {
      // Translate to local coords (relative to center) for rotation
      positions[i * 3] = flatPoints[i].x - centerX;
      positions[i * 3 + 1] = flatPoints[i].y - centerY;
      positions[i * 3 + 2] = 0.02;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, [flatPoints, centerX, centerY]);

  // Build stroke geometry (closed loop outline)
  const strokeGeometry = useMemo(() => {
    if (flatPoints.length < 3) return null;

    const loopPoints = flatPoints.map((p) => new THREE.Vector3(p.x - centerX, p.y - centerY, 0.02));
    return new THREE.BufferGeometry().setFromPoints(loopPoints);
  }, [flatPoints, centerX, centerY]);

  if (!path || path.length < 3 || flatPoints.length < 3) return null;

  const fillOpacity = isDragging ? 0.85 : 0.95;
  const strokeColor = isSelected ? STROKE_SELECTED : isHovered ? strokeHover : strokeDefault;
  const rotationZ = -(effective.rotation * Math.PI) / 180;
  const posZ = 0.02 + 0.01 / Math.max(area, 1);

  void zoom;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return; // Only left-click
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
      position={[centerX, centerY, posZ]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.SHAPES}
    >
      {/* Filled triangulated mesh */}
      {fillGeometry && (
        <mesh
          geometry={fillGeometry}
          renderOrder={RENDER_ORDER.SHAPES}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <meshBasicMaterial
            color={cutFillColor}
            transparent
            opacity={fillOpacity}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Stroke outline */}
      {strokeGeometry && (
        <lineLoop geometry={strokeGeometry} renderOrder={RENDER_ORDER.SHAPES + 1}>
          <lineBasicMaterial color={strokeColor} transparent opacity={1} depthTest={false} />
        </lineLoop>
      )}
    </group>
  );
});
