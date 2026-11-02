/**
 * Red frame around an off-board cutout footprint (e.g. after the bin was
 * shrunk). Pure presentational — the caller supplies the bounds (computed with
 * the same getCutoutBounds detection uses), so this stays free of shape, array,
 * and mask logic. World coordinates: mm, Y-up.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Bounds } from '../geometryCore';
import { RENDER_ORDER, OFF_BOARD_COLOR } from './constants';

interface OffBoardBounds3DProps {
  readonly bounds: Bounds;
  readonly color?: string;
  readonly dashed?: boolean;
}

/** mm the frame sits proud of the shape so it reads as a surrounding warning. */
const MARGIN_MM = 0.75;

export function OffBoardBounds3D({
  bounds,
  color = OFF_BOARD_COLOR,
  dashed = false,
}: OffBoardBounds3DProps) {
  const lineObj = useMemo(() => {
    const x0 = bounds.minX - MARGIN_MM;
    const y0 = bounds.minY - MARGIN_MM;
    const x1 = bounds.maxX + MARGIN_MM;
    const y1 = bounds.maxY + MARGIN_MM;
    const points = [
      new THREE.Vector3(x0, y0, 0.05),
      new THREE.Vector3(x1, y0, 0.05),
      new THREE.Vector3(x1, y1, 0.05),
      new THREE.Vector3(x0, y1, 0.05),
      new THREE.Vector3(x0, y0, 0.05),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const style = {
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    };
    const material = dashed
      ? new THREE.LineDashedMaterial({ ...style, dashSize: 1.5, gapSize: 1 })
      : new THREE.LineBasicMaterial(style);
    const line = new THREE.Line(geometry, material);
    // Dashes are laid out along the distances this writes onto the geometry.
    if (dashed) line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.OFF_BOARD;
    return line;
  }, [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, color, dashed]);

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
