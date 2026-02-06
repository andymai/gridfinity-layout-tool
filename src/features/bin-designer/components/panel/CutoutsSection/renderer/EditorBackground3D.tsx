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
import { RENDER_ORDER, LARGE_BIN_THRESHOLD } from './constants';

interface EditorBackground3DProps {
  readonly binWidth: number;
  readonly binDepth: number;
}

/** Shared tiny circle geometry for instanced dots */
const DOT_GEOMETRY = new THREE.CircleGeometry(0.3, 8);

export function EditorBackground3D({ binWidth, binDepth }: EditorBackground3DProps) {
  const dotInterval = binWidth * binDepth > LARGE_BIN_THRESHOLD ? 2 : 1;

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
      {/* Bin area fill — elevated surface */}
      <mesh position={[binWidth / 2, binDepth / 2, 0]}>
        <planeGeometry args={[binWidth, binDepth]} />
        <meshBasicMaterial color="#252530" depthTest={false} />
      </mesh>

      {/* Dot grid via InstancedMesh */}
      {count > 0 && (
        <instancedMesh
          args={[DOT_GEOMETRY, undefined, count]}
          ref={(mesh) => {
            if (!mesh) return;
            for (let i = 0; i < matrices.length; i++) {
              mesh.setMatrixAt(i, matrices[i]);
            }
            mesh.instanceMatrix.needsUpdate = true;
          }}
        >
          <meshBasicMaterial color="#888888" transparent opacity={0.35} depthTest={false} />
        </instancedMesh>
      )}

      {/* Bin boundary */}
      <lineLoop geometry={boundaryGeometry}>
        <lineBasicMaterial color="#555555" linewidth={2} depthTest={false} />
      </lineLoop>

      {/* Center crosshair — dashed */}
      <lineSegments geometry={crosshairGeometry}>
        <lineDashedMaterial
          color="#555555"
          dashSize={2}
          gapSize={1}
          transparent
          opacity={0.4}
          depthTest={false}
        />
      </lineSegments>
    </group>
  );
}
