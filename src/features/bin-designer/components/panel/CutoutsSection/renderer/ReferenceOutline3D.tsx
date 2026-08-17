/**
 * A faint dashed rectangle showing where ANOTHER part sits under this board.
 *
 * Drawn when the editor is pointed at the lid: lid cutouts live in the lid's own
 * mating-cavity window, which is a different frame from the bin's interior, so
 * there is no coordinate a user could reason from to line a dispensing slot up
 * over the bin's contents. This puts the bin's interior on screen instead, and
 * alignment becomes something you can see.
 *
 * Deliberately NOT a shared origin between the two frames: making lid cutouts
 * read in the bin's coordinates would be a second frame relationship to keep
 * true, which is the failure mode behind CLAUDE.md gotchas #7 and #8.
 *
 * Pure presentational — the caller supplies the rectangle already rebased into
 * the board's frame. World coordinates: mm, Y-up, centred on the board.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER, REFERENCE_OUTLINE_COLOR } from './constants';

interface ReferenceOutline3DProps {
  /** Width in mm of the referenced part. */
  readonly width: number;
  /** Depth in mm of the referenced part. */
  readonly depth: number;
  /** Centre offset in mm from the board's own centre. Zero when concentric. */
  readonly offsetX?: number;
  readonly offsetY?: number;
}

const outlineColor = new THREE.Color(REFERENCE_OUTLINE_COLOR);

/** Dash geometry in mm. Long enough to read as a reference at a fitted zoom. */
const DASH_MM = 2;
const GAP_MM = 1.5;

export function ReferenceOutline3D({
  width,
  depth,
  offsetX = 0,
  offsetY = 0,
}: ReferenceOutline3DProps) {
  const lineObj = useMemo(() => {
    const hw = width / 2;
    const hd = depth / 2;
    // Just above the background so it is not z-fought by it, and well below the
    // shapes. `depthTest: false` means renderOrder decides what covers what
    // anyway; this only keeps the line off the background plane itself.
    const z = 0.02;
    const points = [
      new THREE.Vector3(offsetX - hw, offsetY - hd, z),
      new THREE.Vector3(offsetX + hw, offsetY - hd, z),
      new THREE.Vector3(offsetX + hw, offsetY + hd, z),
      new THREE.Vector3(offsetX - hw, offsetY + hd, z),
      new THREE.Vector3(offsetX - hw, offsetY - hd, z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: outlineColor,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
      dashSize: DASH_MM,
      gapSize: GAP_MM,
    });
    const line = new THREE.Line(geometry, material);
    // Dashes are computed from per-vertex line distances, so a dashed material
    // renders SOLID until this runs. Easy to miss: the outline still appears,
    // just not as a reference-looking one.
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.REFERENCE_OUTLINE;
    return line;
  }, [width, depth, offsetX, offsetY]);

  // <primitive> does not auto-dispose attached objects; release the GPU
  // resources when the line is replaced or the component unmounts.
  useEffect(
    () => () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    },
    [lineObj]
  );

  return <primitive object={lineObj} />;
}
