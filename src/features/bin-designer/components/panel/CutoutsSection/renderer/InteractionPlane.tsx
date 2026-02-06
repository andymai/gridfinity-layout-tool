/**
 * Invisible plane covering the full bin area for background click/drag handling.
 *
 * Catches pointer events that don't hit any shape mesh — used for:
 * - Background click → deselect all + start marquee
 * - Pointer move → forward world-space mm coordinates to interaction handlers
 * - Drawing start (placing mode)
 */

import type { ThreeEvent } from '@react-three/fiber';

interface InteractionPlaneProps {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onPointerDown: (worldX: number, worldY: number, e: ThreeEvent<PointerEvent>) => void;
  readonly onPointerMove: (worldX: number, worldY: number, e: ThreeEvent<PointerEvent>) => void;
  readonly onPointerUp: () => void;
}

export function InteractionPlane({
  binWidth,
  binDepth,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: InteractionPlaneProps) {
  return (
    <mesh
      position={[binWidth / 2, binDepth / 2, -0.01]}
      onPointerDown={(e) => {
        // Only respond to left-click on the plane itself
        if (e.button !== 0) return;
        e.stopPropagation();
        onPointerDown(e.point.x, e.point.y, e);
      }}
      onPointerMove={(e) => {
        onPointerMove(e.point.x, e.point.y, e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp();
      }}
    >
      {/* Generous size to catch events even when panned beyond bin bounds */}
      <planeGeometry args={[binWidth * 3, binDepth * 3]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
