/**
 * A library item following the cursor over the board until a click drops it,
 * or, when it is dragged from the tab, until the press ends over the board.
 *
 * The catch plane sits above every shape (they stack under 50 mm, the camera
 * at 100), so the click that drops the item never selects what lies under it.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { getCutoutOutline } from '../panel/CutoutsSection/cutoutOutline';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from '../panel/CutoutsSection/renderer/constants';
import { placementCentre, type LibraryGhost } from './libraryPlacement';

const CATCH_Z = 60;
const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);

interface LibraryGhost3DProps {
  readonly ghost: LibraryGhost;
  /**
   * The pointer dragging the item from the tab: the ghost hides until it is
   * over the board and drops on its release, and other pointers do nothing.
   * Null for click to place: shown from the start, dropped on a press.
   */
  readonly dragPointer: number | null;
  readonly binWidth: number;
  readonly binDepth: number;
  /** The snap step in mm, or null when snapping is off. */
  readonly grid: number | null;
  /** Space is held for a pan: presses go to the board's pan, not to a drop. */
  readonly panHeld: boolean;
  readonly onDrop: (at: { x: number; y: number }) => void;
  /** The board's own press handler, which starts a pan for these presses. */
  readonly onBoardPress: (x: number, y: number, event: PointerEvent) => void;
}

export function LibraryGhost3D({
  ghost,
  dragPointer,
  binWidth,
  binDepth,
  grid,
  panHeld,
  onDrop,
  onBoardPress,
}: LibraryGhost3DProps) {
  const [at, setAt] = useState(() => ({ x: binWidth / 2, y: binDepth / 2 }));
  const dragged = dragPointer !== null;
  const [shown, setShown] = useState(!dragged);

  const { lines, fill } = useMemo(() => {
    const rings = ghost.cutouts.flatMap((c) =>
      expandCutoutArray(c).flatMap((copy) => getCutoutOutline(copy, ghost.meshAssets) ?? [])
    );
    const material = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const ringLines = rings.map((ring) => {
      const points = [...ring, ring[0]].map((p) => new THREE.Vector3(p.x, p.y, 0.04));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
      line.computeLineDistances();
      line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
      return line;
    });
    const shapes = rings.map(
      (ring) => new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, p.y)))
    );
    return { lines: ringLines, fill: new THREE.ShapeGeometry(shapes) };
  }, [ghost]);

  useEffect(
    () => () => {
      for (const line of lines) line.geometry.dispose();
      (lines[0]?.material as THREE.Material | undefined)?.dispose();
      fill.dispose();
    },
    [lines, fill]
  );

  const board = { width: binWidth, depth: binDepth };
  const follow = (x: number, y: number) => {
    setAt(placementCentre({ x, y }, ghost, board, grid));
    setShown(true);
  };

  return (
    <>
      <mesh
        position={[binWidth / 2, binDepth / 2, CATCH_Z]}
        // Moves pass through, so the board's cursor readout keeps counting.
        onPointerMove={(e) => {
          if (!dragged || e.pointerId === dragPointer) follow(e.point.x, e.point.y);
        }}
        // A drag released off the board drops nothing, so it shows nothing there.
        onPointerOut={() => {
          if (dragged) setShown(false);
        }}
        onPointerUp={(e) => {
          if (e.pointerId !== dragPointer || e.button !== 0) return;
          e.stopPropagation();
          onDrop(placementCentre(e.point, ghost, board, grid));
        }}
        onPointerDown={(e) => {
          // Another pointer's press during a drag neither drops nor reaches a shape.
          if (dragged) {
            e.stopPropagation();
            return;
          }
          // A pan goes to the board directly: let through, the press would reach
          // the shape under it and move that shape.
          if (e.button === 1 || (e.button === 0 && panHeld)) {
            e.stopPropagation();
            onBoardPress(e.point.x, e.point.y, e.nativeEvent);
            return;
          }
          if (e.button !== 0) return;
          e.stopPropagation();
          onDrop(placementCentre(e.point, ghost, board, grid));
        }}
      >
        <planeGeometry args={[binWidth * 3, binDepth * 3]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group position={[at.x, at.y, 0]} visible={shown} renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
        <mesh geometry={fill} position={[0, 0, 0.03]} renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
          <meshBasicMaterial
            color={ACCENT_COLOR}
            transparent
            opacity={0.2}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {lines.map((line) => (
          <primitive key={line.uuid} object={line} />
        ))}
      </group>
    </>
  );
}
