/**
 * Red frame around a cutout stranded past the board edge (e.g. after the bin
 * was shrunk). Drawn around the cutout's rotated bounds so the warning reads
 * the same for every shape type. World coordinates: mm, Y-up.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { getCutoutBounds } from '../maskFit';
import { RENDER_ORDER, OFF_BOARD_COLOR } from './constants';

interface OffBoardBounds3DProps {
  readonly cutout: Cutout;
}

const frameColor = new THREE.Color(OFF_BOARD_COLOR);

/** mm the frame sits proud of the shape so it reads as a surrounding warning. */
const MARGIN_MM = 0.75;

export function OffBoardBounds3D({ cutout }: OffBoardBounds3DProps) {
  const lineObj = useMemo(() => {
    // Match the detection bounds exactly (vertex-based, rotation-aware for
    // paths) so the frame sits on the real footprint, not stale width/depth.
    const b = getCutoutBounds(cutout);
    const x0 = b.minX - MARGIN_MM;
    const y0 = b.minY - MARGIN_MM;
    const x1 = b.maxX + MARGIN_MM;
    const y1 = b.maxY + MARGIN_MM;
    const points = [
      new THREE.Vector3(x0, y0, 0.05),
      new THREE.Vector3(x1, y0, 0.05),
      new THREE.Vector3(x1, y1, 0.05),
      new THREE.Vector3(x0, y1, 0.05),
      new THREE.Vector3(x0, y0, 0.05),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: frameColor,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = RENDER_ORDER.OFF_BOARD;
    return line;
  }, [cutout]);

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
