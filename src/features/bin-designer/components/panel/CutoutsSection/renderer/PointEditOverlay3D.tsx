/**
 * WebGL overlays for editing several path points at once: the transform box
 * around a selection, and the ring that shows how far a grabbed edge pulls
 * the outline with it. Drawn in the canvas frame; sizes in screen pixels
 * through the camera zoom.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Rect } from '../handlers/pointEdits';
import { cornerOf, type TransformHandle } from '../handlers/pointTransform';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const ACCENT = new THREE.Color(ACCENT_COLOR_HEX);
const FILL = new THREE.Color('#ffffff');
const Z = 0.06;
const ORDER = RENDER_ORDER.HANDLES + 12;

const CORNER_PX = 4;
const GRIP_GAP_PX = 10;
/** How far the rotate handle sits above the box, in screen pixels. */
const ROTATE_OFFSET_PX = 22;
const ROTATE_RADIUS_PX = 5;
const RING_SEGMENTS = 64;

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

function useLine(points: readonly { x: number; y: number }[], opacity: number): THREE.Line {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, p.y, Z))
    );
    const material = new THREE.LineBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity,
      depthTest: false,
    });
    const obj = new THREE.Line(geometry, material);
    obj.renderOrder = ORDER;
    return obj;
  }, [points, opacity]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  return line;
}

interface TransformBox3DProps {
  readonly box: Rect;
  readonly zoom: number;
  readonly onHandleDown: (
    handle: TransformHandle,
    mmX: number,
    mmY: number,
    shiftKey: boolean
  ) => void;
}

/**
 * A box around the selected points: corners scale, the dot above it turns. It
 * is drawn a few pixels out from the points, because a grip on a corner point
 * would take the press that selects or moves that point.
 */
export function TransformBox3D({ box, zoom, onHandleDown }: TransformBox3DProps) {
  const gap = GRIP_GAP_PX / zoom;
  const shown = useMemo(
    () => ({
      minX: box.minX - gap,
      minY: box.minY - gap,
      maxX: box.maxX + gap,
      maxY: box.maxY + gap,
    }),
    [box, gap]
  );
  const top = shown.maxY + ROTATE_OFFSET_PX / zoom;
  const midX = (shown.minX + shown.maxX) / 2;
  const outline = useMemo(
    () => [
      { x: shown.minX, y: shown.minY },
      { x: shown.maxX, y: shown.minY },
      { x: shown.maxX, y: shown.maxY },
      { x: shown.minX, y: shown.maxY },
      { x: shown.minX, y: shown.minY },
    ],
    [shown]
  );
  const stem = useMemo(
    () => [
      { x: midX, y: shown.maxY },
      { x: midX, y: top },
    ],
    [midX, shown.maxY, top]
  );
  const frame = useLine(outline, 0.9);
  const stemLine = useLine(stem, 0.9);
  const down = (handle: TransformHandle) => (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    onHandleDown(handle, e.point.x, e.point.y, e.nativeEvent.shiftKey);
  };
  const size = (2 * CORNER_PX) / zoom;
  return (
    <group renderOrder={ORDER}>
      <primitive object={frame} />
      <primitive object={stemLine} />
      {CORNERS.map((handle) => {
        const at = cornerOf(shown, handle);
        return (
          <Grip key={handle} x={at.x} y={at.y} onPointerDown={down(handle)}>
            <planeGeometry args={[size, size]} />
          </Grip>
        );
      })}
      <Grip x={midX} y={top} onPointerDown={down('rotate')}>
        <circleGeometry args={[ROTATE_RADIUS_PX / zoom, 24]} />
      </Grip>
    </group>
  );
}

interface GripProps {
  readonly x: number;
  readonly y: number;
  readonly onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  readonly children: React.ReactNode;
}

function Grip({ x, y, onPointerDown, children }: GripProps) {
  const [hovered, setHovered] = useState(false);
  const scale = hovered ? 1.25 : 1;
  return (
    <mesh
      position={[x, y, Z + 0.001]}
      scale={[scale, scale, 1]}
      renderOrder={ORDER + 1}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {children}
      <meshBasicMaterial color={hovered ? ACCENT : FILL} depthTest={false} transparent />
    </mesh>
  );
}

interface FalloffRing3DProps {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly zoom: number;
  /** Fainter while only hovering, so it reads as a hint and not as a shape. */
  readonly active: boolean;
}

/** Stroke of the pull ring, in screen pixels. */
const RING_STROKE_PX = 1.5;

/**
 * How far a grabbed edge pulls the outline: everything inside the ring
 * follows. A thin annulus rather than a line, so it draws over the shapes the
 * way the point dots do.
 */
export function FalloffRing3D({ x, y, radius, zoom, active }: FalloffRing3DProps) {
  const half = RING_STROKE_PX / zoom / 2;
  const geometry = useMemo(
    () => new THREE.RingGeometry(Math.max(0, radius - half), radius + half, RING_SEGMENTS),
    [radius, half]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group renderOrder={ORDER}>
      <mesh geometry={geometry} position={[x, y, Z]} renderOrder={ORDER}>
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={active ? 0.9 : 0.45}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
