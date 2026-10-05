/**
 * WebGL background for the cutout editor canvas.
 *
 * Renders:
 * - Bin area fill (elevated surface plane)
 * - Bin boundary (line loop)
 * - Dot grid via InstancedMesh, spaced by `getDotInterval`
 * - Center crosshair dashed lines
 *
 * World coordinates: mm, Y-up. Origin at (0,0) = front-left corner.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSettingsStore } from '@/core/store/settings';
import { isPartialMask, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';
import { RENDER_ORDER } from './constants';
import { getDotGridStyle, getDotInterval } from './dotGrid';

interface EditorBackground3DProps {
  readonly binWidth: number;
  readonly binDepth: number;
  /** Non-rectangular footprint mask. When present, bin fill/outline follow the polygon. */
  readonly cellMask?: CellMask;
  readonly zoom: number;
  readonly binColor: string;
}

export function EditorBackground3D({
  binWidth,
  binDepth,
  cellMask,
  zoom,
  binColor,
}: EditorBackground3DProps) {
  const hasPolygon = isPartialMask(cellMask);
  const dotInterval = getDotInterval(binWidth, binDepth, zoom);
  const highContrast = useSettingsStore((s) => s.settings.highContrast);
  const dotStyle = useMemo(() => getDotGridStyle(binColor, highContrast), [binColor, highContrast]);
  const dotColor = dotStyle.color;

  // Constant screen-size dot radius (convert screen px to world mm)
  const dotRadius = dotStyle.radiusPx / zoom;

  // Dot geometry recreated when zoom changes (screen-space sizing)
  const dotGeometry = useMemo(() => new THREE.CircleGeometry(dotRadius, 6), [dotRadius]);

  // Build instanced mesh matrices for grid dots. For custom shapes, skip dots
  // whose sample cell is outside the polygon — keeps the "inside" region visible.
  const { matrices, count } = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const tempMatrix = new THREE.Matrix4();
    const cellMmX = cellMask ? binWidth / cellMask.cols : 0;
    const cellMmY = cellMask ? binDepth / cellMask.rows : 0;
    for (let x = 0; x <= binWidth; x += dotInterval) {
      for (let y = 0; y <= binDepth; y += dotInterval) {
        if (cellMask && hasPolygon) {
          // Find containing cell. Clamp to valid range; dots on the far edge
          // belong to the last cell, not a phantom cell past the end.
          const c = Math.min(cellMask.cols - 1, Math.max(0, Math.floor(x / cellMmX)));
          const r = Math.min(cellMask.rows - 1, Math.max(0, Math.floor(y / cellMmY)));
          if (cellMask.cells[r * cellMask.cols + c] !== 1) continue;
        }
        tempMatrix.makeTranslation(x, y, 0.01);
        mats.push(tempMatrix.clone());
      }
    }
    return { matrices: mats, count: mats.length };
  }, [binWidth, binDepth, dotInterval, cellMask, hasPolygon]);

  // Polygon loops scaled from mask grid units to editor interior mm.
  // Using binWidth/binDepth (vs gridUnitMm) keeps validator and visuals aligned:
  // the polygon outline traces exactly the region where cutouts are accepted.
  const polygonLoops = useMemo(() => {
    if (!cellMask || !hasPolygon) return null;
    const loops = maskToPolygon(cellMask);
    const scaleX = binWidth / (cellMask.cols * 0.5);
    const scaleY = binDepth / (cellMask.rows * 0.5);
    return loops.map((loop) => loop.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY })));
  }, [cellMask, hasPolygon, binWidth, binDepth]);

  // THREE.Shape for filled polygon area (outer loop + holes)
  const polygonShape = useMemo(() => {
    if (!polygonLoops || polygonLoops.length === 0) return null;
    const [outer, ...holes] = polygonLoops;
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.y)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.y))));
    }
    return shape;
  }, [polygonLoops]);

  // Bin boundary line — rectangular AABB or polygon loops
  const boundaryGeometry = useMemo(() => {
    if (!polygonLoops) {
      const points = [
        new THREE.Vector3(0, 0, 0.005),
        new THREE.Vector3(binWidth, 0, 0.005),
        new THREE.Vector3(binWidth, binDepth, 0.005),
        new THREE.Vector3(0, binDepth, 0.005),
        new THREE.Vector3(0, 0, 0.005),
      ];
      return new THREE.BufferGeometry().setFromPoints(points);
    }
    // Concatenate all loops as discontinuous line segments — use a dummy break
    // between loops by emitting each as its own closed polyline.
    const segments: number[] = [];
    for (const loop of polygonLoops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        segments.push(a.x, a.y, 0.005, b.x, b.y, 0.005);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments), 3));
    return geo;
  }, [binWidth, binDepth, polygonLoops]);

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
      {/* Bin area fill — polygon footprint for custom shapes, rectangle otherwise */}
      {polygonShape ? (
        <mesh position={[0, 0, 0]}>
          <shapeGeometry args={[polygonShape]} />
          <meshBasicMaterial color={binColor} depthTest={false} />
        </mesh>
      ) : (
        <mesh position={[binWidth / 2, binDepth / 2, 0]}>
          <planeGeometry args={[binWidth, binDepth]} />
          <meshBasicMaterial color={binColor} depthTest={false} />
        </mesh>
      )}

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
          <meshBasicMaterial
            color={dotColor}
            transparent
            opacity={dotStyle.opacity}
            depthTest={false}
          />
        </instancedMesh>
      )}

      {/* Bin boundary — lineLoop (closed) for rectangle, lineSegments for polygon loops */}
      {polygonLoops ? (
        <lineSegments geometry={boundaryGeometry}>
          <lineBasicMaterial color={dotColor} transparent opacity={0.35} depthTest={false} />
        </lineSegments>
      ) : (
        <lineLoop geometry={boundaryGeometry}>
          <lineBasicMaterial color={dotColor} transparent opacity={0.25} depthTest={false} />
        </lineLoop>
      )}

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
