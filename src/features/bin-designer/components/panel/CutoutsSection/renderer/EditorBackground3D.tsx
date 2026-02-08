/**
 * WebGL background for the cutout editor canvas.
 *
 * Renders:
 * - Bin area fill (elevated surface plane)
 * - Bin boundary (line loop)
 * - Dot grid at 1mm intervals (2mm for large bins) via InstancedMesh
 * - Center crosshair dashed lines
 *
 * World coordinates: mm, Y-up. Origin at (0,0) = front-left corner.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER, LARGE_BIN_THRESHOLD, DOT_RADIUS_PX } from './constants';

interface EditorBackground3DProps {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly zoom: number;
  readonly binColor: string;
}

/** Compute dot spacing based on zoom and bin size */
function getDotInterval(binWidth: number, binDepth: number, zoom: number): number {
  const area = binWidth * binDepth;
  const isLarge = area > LARGE_BIN_THRESHOLD;
  // Adaptive: at very high zoom, thin out dots since rulers show scale
  if (zoom > 15) return isLarge ? 10 : 5;
  if (zoom > 8) return isLarge ? 5 : 2;
  return isLarge ? 2 : 1;
}

export function EditorBackground3D({
  binWidth,
  binDepth,
  zoom,
  binColor,
}: EditorBackground3DProps) {
  const dotInterval = getDotInterval(binWidth, binDepth, zoom);

  // Constant screen-size dot radius (convert screen px to world mm)
  const dotRadius = DOT_RADIUS_PX / zoom;

  // Dots contrast against the bin surface: darken for light surfaces, lighten for dark
  const binLuminance = useMemo(
    () => new THREE.Color(binColor).getHSL({ h: 0, s: 0, l: 0 }).l,
    [binColor]
  );
  const dotColor = binLuminance > 0.5 ? '#000000' : '#ffffff';
  const dotOpacity = binLuminance > 0.5 ? 0.12 : 0.1;

  // Dot geometry recreated when zoom changes (screen-space sizing)
  const dotGeometry = useMemo(() => new THREE.CircleGeometry(dotRadius, 6), [dotRadius]);

  // Build instanced mesh matrices for grid dots
  const { matrices, count } = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const tempMatrix = new THREE.Matrix4();
    for (let x = 0; x <= binWidth; x += dotInterval) {
      for (let y = 0; y <= binDepth; y += dotInterval) {
        tempMatrix.makeTranslation(x, y, 0.01);
        mats.push(tempMatrix.clone());
      }
    }
    return { matrices: mats, count: mats.length };
  }, [binWidth, binDepth, dotInterval]);

  // Bin boundary line
  const boundaryGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0, 0.005),
      new THREE.Vector3(binWidth, 0, 0.005),
      new THREE.Vector3(binWidth, binDepth, 0.005),
      new THREE.Vector3(0, binDepth, 0.005),
      new THREE.Vector3(0, 0, 0.005),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [binWidth, binDepth]);

  // Center crosshair lines
  const crosshairGeometry = useMemo(() => {
    const cx = binWidth / 2;
    const cy = binDepth / 2;
    const positions = new Float32Array([
      // Horizontal line
      0,
      cy,
      0.005,
      binWidth,
      cy,
      0.005,
      // Vertical line
      cx,
      0,
      0.005,
      cx,
      binDepth,
      0.005,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [binWidth, binDepth]);

  return (
    <group renderOrder={RENDER_ORDER.BACKGROUND}>
      {/* Bin area fill — uses user's selected preview color */}
      <mesh position={[binWidth / 2, binDepth / 2, 0]}>
        <planeGeometry args={[binWidth, binDepth]} />
        <meshBasicMaterial color={binColor} depthTest={false} />
      </mesh>

      {/* Dot grid via InstancedMesh */}
      {count > 0 && (
        <instancedMesh
          args={[dotGeometry, undefined, count]}
          ref={(mesh) => {
            if (!mesh) return;
            for (let i = 0; i < matrices.length; i++) {
              mesh.setMatrixAt(i, matrices[i]);
            }
            mesh.instanceMatrix.needsUpdate = true;
          }}
        >
          <meshBasicMaterial color={dotColor} transparent opacity={dotOpacity} depthTest={false} />
        </instancedMesh>
      )}

      {/* Bin boundary */}
      <lineLoop geometry={boundaryGeometry}>
        <lineBasicMaterial color={dotColor} transparent opacity={0.25} depthTest={false} />
      </lineLoop>

      {/* Center crosshair — very subtle */}
      <lineSegments geometry={crosshairGeometry}>
        <lineDashedMaterial
          color={dotColor}
          dashSize={2}
          gapSize={2}
          transparent
          opacity={0.08}
          depthTest={false}
        />
      </lineSegments>
    </group>
  );
}
