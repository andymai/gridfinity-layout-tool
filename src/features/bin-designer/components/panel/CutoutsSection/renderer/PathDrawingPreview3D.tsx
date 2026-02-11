/**
 * WebGL drawing preview for pen tool path creation.
 *
 * Shows the in-progress path with solid lines for placed segments and
 * a lighter line to the cursor. Includes Figma-quality vertex indicators
 * and prominent path closure feedback. World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { PathPoint } from '@/features/bin-designer/types';
import { flattenPath, MIN_PATH_POINTS } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface PathDrawingPreview3DProps {
  readonly points: readonly PathPoint[];
  readonly cursorX: number;
  readonly cursorY: number;
  readonly canClose: boolean;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);
const WHITE = new THREE.Color('#ffffff');
const CURSOR_LINE_COLOR = new THREE.Color('#888888');
const CLOSE_LINE_COLOR = new THREE.Color('#22c55e'); // Green for "ready to close"
const Z = 0.04;
const VERTEX_OUTER_RADIUS_PX = 4.5;
const VERTEX_INNER_RADIUS_PX = 3;
// Close indicator is much larger — must be unmissable
const CLOSE_INDICATOR_OUTER_PX = 10;
const CLOSE_INDICATOR_INNER_PX = 7;
const CLOSE_RING_PX = 14; // Pulsing target ring
const CIRCLE_SEGMENTS = 24;

export function PathDrawingPreview3D({
  points,
  cursorX,
  cursorY,
  canClose,
}: PathDrawingPreview3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  const vOuter = VERTEX_OUTER_RADIUS_PX / zoom;
  const vInner = VERTEX_INNER_RADIUS_PX / zoom;
  const closeOuter = CLOSE_INDICATOR_OUTER_PX / zoom;
  const closeInner = CLOSE_INDICATOR_INNER_PX / zoom;
  const closeRing = CLOSE_RING_PX / zoom;

  // Flatten existing points to polyline for the placed segments
  const flatPoints = useMemo(() => {
    if (points.length < 2) return null;
    return flattenPath(points);
  }, [points]);

  // Solid line through placed points
  const placedLineObj = useMemo(() => {
    if (!flatPoints || flatPoints.length < 2) return null;
    const linePoints = flatPoints.map((p) => new THREE.Vector3(p.x, p.y, Z));
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8, depthTest: false });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return obj;
  }, [flatPoints]);

  // Update placed line color based on canClose
  useMemo(() => {
    if (!placedLineObj) return;
    placedLineObj.material.color.copy(canClose ? CLOSE_LINE_COLOR : ACCENT_COLOR);
  }, [placedLineObj, canClose]);

  // Line from last point to cursor (snaps to first point when can close)
  const cursorLineObj = useMemo(() => {
    if (points.length === 0) return null;
    const lastPt = points[points.length - 1];
    const targetX = canClose ? points[0].x : cursorX;
    const targetY = canClose ? points[0].y : cursorY;
    const linePoints = [
      new THREE.Vector3(lastPt.x, lastPt.y, Z),
      new THREE.Vector3(targetX, targetY, Z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const mat = new THREE.LineBasicMaterial({
      color: canClose ? CLOSE_LINE_COLOR : CURSOR_LINE_COLOR,
      transparent: true,
      opacity: canClose ? 0.8 : 0.5,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return obj;
  }, [points, cursorX, cursorY, canClose]);

  // Closing preview line: only show when we have enough points to close
  const closingLineObj = useMemo(() => {
    if (points.length < MIN_PATH_POINTS) return null;
    if (canClose) return null; // When close is active, cursor line already snaps to first point
    const firstPt = points[0];
    const linePoints = [
      new THREE.Vector3(cursorX, cursorY, Z),
      new THREE.Vector3(firstPt.x, firstPt.y, Z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const mat = new THREE.LineBasicMaterial({
      color: CURSOR_LINE_COLOR,
      transparent: true,
      opacity: 0.15,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return obj;
  }, [points, cursorX, cursorY, canClose]);

  // Handle visualization for latest point
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const handleLineGeo = useMemo(() => {
    if (!lastPoint || (!lastPoint.handleIn && !lastPoint.handleOut)) return null;

    const handlePoints: THREE.Vector3[] = [];
    if (lastPoint.handleIn) {
      handlePoints.push(
        new THREE.Vector3(
          lastPoint.x + lastPoint.handleIn.dx,
          lastPoint.y + lastPoint.handleIn.dy,
          Z
        ),
        new THREE.Vector3(lastPoint.x, lastPoint.y, Z)
      );
    }
    if (lastPoint.handleOut) {
      handlePoints.push(
        new THREE.Vector3(lastPoint.x, lastPoint.y, Z),
        new THREE.Vector3(
          lastPoint.x + lastPoint.handleOut.dx,
          lastPoint.y + lastPoint.handleOut.dy,
          Z
        )
      );
    }

    const positions = new Float32Array(handlePoints.length * 3);
    for (let i = 0; i < handlePoints.length; i++) {
      positions[i * 3] = handlePoints[i].x;
      positions[i * 3 + 1] = handlePoints[i].y;
      positions[i * 3 + 2] = handlePoints[i].z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [lastPoint]);

  // Circle geometries
  const outerGeo = useMemo(() => new THREE.CircleGeometry(vOuter, CIRCLE_SEGMENTS), [vOuter]);
  const innerGeo = useMemo(() => new THREE.CircleGeometry(vInner, CIRCLE_SEGMENTS), [vInner]);
  const closeRingGeo = useMemo(
    () => new THREE.RingGeometry(closeRing * 0.7, closeRing, CIRCLE_SEGMENTS),
    [closeRing]
  );

  return (
    <group renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
      {/* Solid line through placed points */}
      {placedLineObj && <primitive object={placedLineObj} />}

      {/* Line from last point to cursor/close target */}
      {cursorLineObj && <primitive object={cursorLineObj} />}

      {/* Subtle closing hint line when 3+ points but not yet in close range */}
      {closingLineObj && <primitive object={closingLineObj} />}

      {/* Handle lines for latest point (solid, not dashed) */}
      {handleLineGeo && (
        <lineSegments geometry={handleLineGeo} renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
          <lineBasicMaterial color={ACCENT_COLOR} transparent opacity={0.5} depthTest={false} />
        </lineSegments>
      )}

      {/* Handle dots for latest point */}
      {lastPoint?.handleIn && (
        <group
          position={[lastPoint.x + lastPoint.handleIn.dx, lastPoint.y + lastPoint.handleIn.dy, Z]}
        >
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
            <circleGeometry args={[vOuter * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
          </mesh>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2} position={[0, 0, 0.001]}>
            <circleGeometry args={[vInner * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={WHITE} depthTest={false} />
          </mesh>
        </group>
      )}
      {lastPoint?.handleOut && (
        <group
          position={[lastPoint.x + lastPoint.handleOut.dx, lastPoint.y + lastPoint.handleOut.dy, Z]}
        >
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
            <circleGeometry args={[vOuter * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
          </mesh>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2} position={[0, 0, 0.001]}>
            <circleGeometry args={[vInner * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={WHITE} depthTest={false} />
          </mesh>
        </group>
      )}

      {/* ─── Close indicator ─── */}
      {/* Always-visible target ring around first vertex when 3+ points */}
      {points.length >= MIN_PATH_POINTS && !canClose && (
        <mesh
          position={[points[0].x, points[0].y, Z]}
          renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}
        >
          <primitive object={closeRingGeo} attach="geometry" />
          <meshBasicMaterial color={ACCENT_COLOR} transparent opacity={0.2} depthTest={false} />
        </mesh>
      )}

      {/* Prominent close indicator when cursor is in range — large green target */}
      {canClose && points.length >= MIN_PATH_POINTS && (
        <group position={[points[0].x, points[0].y, Z]}>
          {/* Outer glow ring */}
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
            <circleGeometry args={[closeRing, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial
              color={CLOSE_LINE_COLOR}
              transparent
              opacity={0.15}
              depthTest={false}
            />
          </mesh>
          {/* Solid green outer circle */}
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2} position={[0, 0, 0.001]}>
            <circleGeometry args={[closeOuter, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={CLOSE_LINE_COLOR} depthTest={false} />
          </mesh>
          {/* White inner fill */}
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 3} position={[0, 0, 0.002]}>
            <circleGeometry args={[closeInner, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={WHITE} depthTest={false} />
          </mesh>
        </group>
      )}

      {/* Vertex dots at each placed point — Figma-style with border */}
      {points.map((pt, i) => (
        <group key={i} position={[pt.x, pt.y, Z]}>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 4}>
            <primitive object={outerGeo} attach="geometry" />
            <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
          </mesh>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 5} position={[0, 0, 0.001]}>
            <primitive object={innerGeo} attach="geometry" />
            <meshBasicMaterial color={WHITE} depthTest={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
