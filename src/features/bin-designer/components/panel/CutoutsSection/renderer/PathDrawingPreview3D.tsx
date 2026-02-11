/**
 * WebGL drawing preview for pen tool path creation.
 *
 * Shows the in-progress path as dashed lines while the user places vertices.
 * Includes visual indicators for vertex positions and path closure.
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { PathPoint } from '@/features/bin-designer/types';
import { flattenPath } from '../pathGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface PathDrawingPreview3DProps {
  readonly points: readonly PathPoint[];
  readonly cursorX: number;
  readonly cursorY: number;
  readonly canClose: boolean;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);
const WHITE = new THREE.Color('#ffffff');
const Z = 0.04;
const VERTEX_RADIUS_MM = 2;
const CLOSE_INDICATOR_RADIUS_MM = 3;
const CIRCLE_SEGMENTS = 16;

const createDashedMaterial = (opacity: number) =>
  new THREE.LineDashedMaterial({
    color: ACCENT_COLOR,
    dashSize: 2,
    gapSize: 1,
    transparent: true,
    opacity,
    depthTest: false,
  });

export function PathDrawingPreview3D({
  points,
  cursorX,
  cursorY,
  canClose,
}: PathDrawingPreview3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  // Scale vertex circles inversely with zoom for constant screen size
  const vertexRadius = VERTEX_RADIUS_MM / zoom;
  const closeRadius = CLOSE_INDICATOR_RADIUS_MM / zoom;

  // Flatten existing points to polyline for the placed segments
  const flatPoints = useMemo(() => {
    if (points.length < 2) return null;
    return flattenPath(points);
  }, [points]);

  const placedLineObj = useMemo(() => {
    if (!flatPoints || flatPoints.length < 2) return null;

    const linePoints = flatPoints.map((p) => new THREE.Vector3(p.x, p.y, Z));
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const line = new THREE.Line(geometry, createDashedMaterial(0.6));
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [flatPoints]);

  const cursorLineObj = useMemo(() => {
    if (points.length === 0) return null;

    const lastPt = points[points.length - 1];
    const linePoints = [
      new THREE.Vector3(lastPt.x, lastPt.y, Z),
      new THREE.Vector3(cursorX, cursorY, Z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const line = new THREE.Line(geometry, createDashedMaterial(0.6));
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [points, cursorX, cursorY]);

  const closingLineObj = useMemo(() => {
    if (points.length < 2) return null;

    const firstPt = points[0];
    const linePoints = [
      new THREE.Vector3(cursorX, cursorY, Z),
      new THREE.Vector3(firstPt.x, firstPt.y, Z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const line = new THREE.Line(geometry, createDashedMaterial(0.3));
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [points, cursorX, cursorY]);

  // Circle geometries for vertices
  const vertexCircleGeometry = useMemo(
    () => new THREE.CircleGeometry(vertexRadius, CIRCLE_SEGMENTS),
    [vertexRadius]
  );
  const closeCircleGeometry = useMemo(
    () => new THREE.CircleGeometry(closeRadius, CIRCLE_SEGMENTS),
    [closeRadius]
  );

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const handleLineObj = useMemo(() => {
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
    const material = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 1,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const line = new THREE.LineSegments(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [lastPoint]);

  return (
    <group renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
      {/* Dashed line through placed points */}
      {placedLineObj && <primitive object={placedLineObj} />}

      {/* Line from last point to cursor */}
      {cursorLineObj && <primitive object={cursorLineObj} />}

      {/* Closing preview line from cursor back to first point */}
      {closingLineObj && <primitive object={closingLineObj} />}

      {/* Handle lines for latest point */}
      {handleLineObj && <primitive object={handleLineObj} />}

      {/* Handle dots for latest point */}
      {lastPoint?.handleIn && (
        <mesh
          position={[lastPoint.x + lastPoint.handleIn.dx, lastPoint.y + lastPoint.handleIn.dy, Z]}
          renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}
        >
          <primitive object={vertexCircleGeometry} attach="geometry" />
          <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
        </mesh>
      )}
      {lastPoint?.handleOut && (
        <mesh
          position={[lastPoint.x + lastPoint.handleOut.dx, lastPoint.y + lastPoint.handleOut.dy, Z]}
          renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}
        >
          <primitive object={vertexCircleGeometry} attach="geometry" />
          <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
        </mesh>
      )}

      {/* Close indicator: highlighted circle at first point when can close */}
      {canClose && points.length >= 3 && (
        <mesh
          position={[points[0].x, points[0].y, Z]}
          renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}
        >
          <primitive object={closeCircleGeometry} attach="geometry" />
          <meshBasicMaterial color={ACCENT_COLOR} transparent opacity={0.4} depthTest={false} />
        </mesh>
      )}

      {/* Vertex dots at each placed point */}
      {points.map((pt, i) => (
        <mesh key={i} position={[pt.x, pt.y, Z]} renderOrder={RENDER_ORDER.DRAWING_PREVIEW + 1}>
          <circleGeometry args={[vertexRadius, CIRCLE_SEGMENTS]} />
          <meshBasicMaterial color={WHITE} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
