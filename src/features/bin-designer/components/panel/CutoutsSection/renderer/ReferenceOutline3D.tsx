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
 * Pure presentational — the referenced rectangle is drawn concentric with the
 * board. World coordinates: mm, Y-up. Origin at (0,0) = front-left corner —
 * matching `EditorBackground3D`, so the board's centre is (binWidth/2,
 * binDepth/2) and not the origin.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER, REFERENCE_OUTLINE_COLOR } from './constants';

interface ReferenceOutline3DProps {
  /** Board extent in mm — the outline is centred on it. */
  readonly binWidth: number;
  readonly binDepth: number;
  readonly width: number;
  readonly depth: number;
}

const outlineColor = new THREE.Color(REFERENCE_OUTLINE_COLOR);

/** Dash geometry in mm. Long enough to read as a reference at a fitted zoom. */
const DASH_MM = 2;
const GAP_MM = 1.5;

export function ReferenceOutline3D({ binWidth, binDepth, width, depth }: ReferenceOutline3DProps) {
  const lineObj = useMemo(() => {
    // The board runs [0, binWidth] x [0, binDepth], so concentric means centred
    // on its midpoint — NOT on the world origin, which is its front-left corner.
    const x0 = (binWidth - width) / 2;
    const x1 = (binWidth + width) / 2;
    const y0 = (binDepth - depth) / 2;
    const y1 = (binDepth + depth) / 2;
    // Just above the background so it is not z-fought by it, and well below the
    // shapes. `depthTest: false` means renderOrder decides what covers what
    // anyway; this only keeps the line off the background plane itself.
    const z = 0.02;
    const points = [
      new THREE.Vector3(x0, y0, z),
      new THREE.Vector3(x1, y0, z),
      new THREE.Vector3(x1, y1, z),
      new THREE.Vector3(x0, y1, z),
      new THREE.Vector3(x0, y0, z),
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
  }, [binWidth, binDepth, width, depth]);

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
