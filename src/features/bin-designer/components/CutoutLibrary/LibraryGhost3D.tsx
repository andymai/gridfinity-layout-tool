/**
 * A library item following the cursor over the board until a click drops it.
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
  readonly binWidth: number;
  readonly binDepth: number;
  /** The snap step in mm, or null when snapping is off. */
  readonly grid: number | null;
  /** Space is held for a pan: presses go to the board's pan, not to a drop. */
  readonly panHeld: boolean;
  readonly onDrop: (at: { x: number; y: number }) => void;
}

export function LibraryGhost3D({
  ghost,
  binWidth,
  binDepth,
  grid,
  panHeld,
  onDrop,
}: LibraryGhost3DProps) {
  const [at, setAt] = useState(() => ({ x: binWidth / 2, y: binDepth / 2 }));

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

  const follow = (x: number, y: number) =>
    setAt(placementCentre({ x, y }, ghost, { width: binWidth, depth: binDepth }, grid));

  return (
    <>
      <mesh
        position={[binWidth / 2, binDepth / 2, CATCH_Z]}
        // Moves pass through, so the board's cursor readout keeps counting.
        onPointerMove={(e) => follow(e.point.x, e.point.y)}
        onPointerDown={(e) => {
          if (e.button !== 0 || panHeld) return;
          e.stopPropagation();
          onDrop(placementCentre(e.point, ghost, { width: binWidth, depth: binDepth }, grid));
        }}
      >
        <planeGeometry args={[binWidth * 3, binDepth * 3]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group position={[at.x, at.y, 0]} renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
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
