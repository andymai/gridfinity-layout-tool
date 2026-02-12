/**
 * WebGL drawing preview for pen tool path creation.
 *
 * Shows the in-progress path with solid lines for placed segments and
 * a lighter line to the cursor. Vertex dots are interactive — clicking
 * an existing vertex during drawing initiates repositioning.
 * World coordinates: mm, Y-up.
 */

import { useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { PathPoint } from '@/features/bin-designer/types';
import { flattenPath, MIN_PATH_POINTS } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface PathDrawingPreview3DProps {
  readonly points: readonly PathPoint[];
  readonly cursorX: number;
  readonly cursorY: number;
  readonly canClose: boolean;
  /** Called when the user presses on an existing vertex dot to reposition it. */
  readonly onVertexDown?: (index: number, mmX: number, mmY: number) => void;
}

/** Figma-style: blue border, white fill — pops on any background */
const HANDLE_BORDER = new THREE.Color('#0d99ff');
const HANDLE_FILL = new THREE.Color('#ffffff');
const LINE_COLOR = new THREE.Color(ACCENT_COLOR_HEX);
const CURSOR_LINE_COLOR = new THREE.Color('#888888');
const Z = 0.04;
const VERTEX_OUTER_RADIUS_PX = 5;
const VERTEX_INNER_RADIUS_PX = 3;
const CIRCLE_SEGMENTS = 24;

const CLOSE_RING_RADIUS_PX = 7;

export function PathDrawingPreview3D({
  points,
  cursorX,
  cursorY,
  canClose,
  onVertexDown,
}: PathDrawingPreview3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  const vOuter = VERTEX_OUTER_RADIUS_PX / zoom;
  const vInner = VERTEX_INNER_RADIUS_PX / zoom;
  const closeRingRadius = CLOSE_RING_RADIUS_PX / zoom;

  // Flatten existing points to polyline for the placed segments
  const flatPoints = useMemo(() => {
    if (points.length < 2) return null;
    return flattenPath(points, undefined, false);
  }, [points]);

  // Solid line through placed points
  const placedLineObj = useMemo(() => {
    if (!flatPoints || flatPoints.length < 2) return null;
    const linePoints = flatPoints.map((p) => new THREE.Vector3(p.x, p.y, Z));
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const mat = new THREE.LineBasicMaterial({
      color: LINE_COLOR,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return obj;
  }, [flatPoints]);

  useEffect(() => {
    return () => {
      if (placedLineObj) {
        placedLineObj.geometry.dispose();
        (placedLineObj.material as THREE.Material).dispose();
      }
    };
  }, [placedLineObj]);

  // Line from last point to cursor (snaps to first vertex when closing)
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
      color: canClose ? LINE_COLOR : CURSOR_LINE_COLOR,
      transparent: true,
      opacity: canClose ? 0.8 : 0.5,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return obj;
  }, [points, cursorX, cursorY, canClose]);

  useEffect(() => {
    return () => {
      if (cursorLineObj) {
        cursorLineObj.geometry.dispose();
        (cursorLineObj.material as THREE.Material).dispose();
      }
    };
  }, [cursorLineObj]);

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

  useEffect(() => {
    return () => {
      handleLineGeo?.dispose();
    };
  }, [handleLineGeo]);

  // Circle geometries
  const outerGeo = useMemo(() => new THREE.CircleGeometry(vOuter, CIRCLE_SEGMENTS), [vOuter]);
  const innerGeo = useMemo(() => new THREE.CircleGeometry(vInner, CIRCLE_SEGMENTS), [vInner]);

  useEffect(() => {
    return () => {
      outerGeo.dispose();
    };
  }, [outerGeo]);

  useEffect(() => {
    return () => {
      innerGeo.dispose();
    };
  }, [innerGeo]);

  // Vertex pointer handler factory
  const makeVertexDown = useCallback(
    (index: number) => (e: ThreeEvent<PointerEvent>) => {
      if (e.nativeEvent.button !== 0) return;
      e.stopPropagation();
      onVertexDown?.(index, e.point.x, e.point.y);
    },
    [onVertexDown]
  );

  return (
    <group renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
      {/* Solid line through placed points */}
      {placedLineObj && <primitive object={placedLineObj} />}

      {/* Line from last point to cursor */}
      {cursorLineObj && <primitive object={cursorLineObj} />}

      {/* Handle lines for latest point */}
      {handleLineGeo && (
        <lineSegments geometry={handleLineGeo} renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
          <lineBasicMaterial color={HANDLE_BORDER} transparent opacity={0.5} depthTest={false} />
        </lineSegments>
      )}

      {/* Handle dots for latest point */}
      {lastPoint?.handleIn && (
        <group
          position={[lastPoint.x + lastPoint.handleIn.dx, lastPoint.y + lastPoint.handleIn.dy, Z]}
        >
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
            <circleGeometry args={[vOuter * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={1} depthTest={false} />
          </mesh>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2} position={[0, 0, 0.001]}>
            <circleGeometry args={[vInner * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={HANDLE_FILL} transparent opacity={1} depthTest={false} />
          </mesh>
        </group>
      )}
      {lastPoint?.handleOut && (
        <group
          position={[lastPoint.x + lastPoint.handleOut.dx, lastPoint.y + lastPoint.handleOut.dy, Z]}
        >
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
            <circleGeometry args={[vOuter * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={1} depthTest={false} />
          </mesh>
          <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2} position={[0, 0, 0.001]}>
            <circleGeometry args={[vInner * 0.7, CIRCLE_SEGMENTS]} />
            <meshBasicMaterial color={HANDLE_FILL} transparent opacity={1} depthTest={false} />
          </mesh>
        </group>
      )}

      {/* Interactive vertex dots — click to reposition existing points */}
      {points.map((pt, i) => {
        const isFirst = i === 0;
        const showCloseIndicator = isFirst && canClose && points.length >= MIN_PATH_POINTS;
        return (
          <group key={i} position={[pt.x, pt.y, Z]} onPointerDown={makeVertexDown(i)}>
            {/* Close ring */}
            {showCloseIndicator && (
              <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 2}>
                <circleGeometry args={[closeRingRadius, CIRCLE_SEGMENTS]} />
                <meshBasicMaterial
                  color={HANDLE_BORDER}
                  transparent
                  opacity={0.25}
                  depthTest={false}
                />
              </mesh>
            )}
            {/* Blue border */}
            <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 3}>
              <primitive object={outerGeo} attach="geometry" />
              <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={1} depthTest={false} />
            </mesh>
            {/* White fill, solid blue when close-ready */}
            <mesh renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 4} position={[0, 0, 0.001]}>
              <primitive object={innerGeo} attach="geometry" />
              <meshBasicMaterial
                color={showCloseIndicator ? HANDLE_BORDER : HANDLE_FILL}
                transparent
                opacity={1}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
