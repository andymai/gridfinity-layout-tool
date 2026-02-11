/**
 * WebGL overlay for pen tool vertex editing.
 *
 * Shows interactive vertex circles and bezier control handle lines/dots
 * when editing a committed path cutout. Screen-space sizing via camera zoom.
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface PathEditOverlay3DProps {
  readonly cutout: Cutout;
  readonly selectedPointIndex: number | null;
  readonly previewOverrides?: Partial<Cutout>;
  readonly onPointDown: (index: number, mmX: number, mmY: number) => void;
  readonly onHandleDown: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);
const WHITE = new THREE.Color('#ffffff');
const HANDLE_DOT_COLOR = new THREE.Color('#93c5fd'); // Light blue for handle endpoints
const Z = 0.05;
const VERTEX_RADIUS_PX = 3;
const HANDLE_DOT_SIZE_PX = 2.5;
const CIRCLE_SEGMENTS = 16;
const OVERLAY_RENDER_ORDER = RENDER_ORDER.HANDLES + 10;

export function PathEditOverlay3D({
  cutout,
  selectedPointIndex,
  previewOverrides,
  onPointDown,
  onHandleDown,
}: PathEditOverlay3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  // Merge preview overrides for live feedback
  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  const path = effective.path;
  if (!path || path.length === 0) return null;

  // Screen-space sizing
  const vertexRadius = VERTEX_RADIUS_PX / zoom;
  const handleDotHalf = HANDLE_DOT_SIZE_PX / zoom;

  return (
    <group renderOrder={OVERLAY_RENDER_ORDER}>
      {path.map((pt, i) => {
        const isSelected = selectedPointIndex === i;

        return (
          <group key={i}>
            {/* Handle-in line and dot */}
            {pt.handleIn && (
              <HandleLine
                pointX={pt.x}
                pointY={pt.y}
                handleDx={pt.handleIn.dx}
                handleDy={pt.handleIn.dy}
                dotHalfSize={handleDotHalf}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (e.nativeEvent.button !== 0) return;
                  e.stopPropagation();
                  onHandleDown(i, 'in', e.point.x, e.point.y);
                }}
              />
            )}

            {/* Handle-out line and dot */}
            {pt.handleOut && (
              <HandleLine
                pointX={pt.x}
                pointY={pt.y}
                handleDx={pt.handleOut.dx}
                handleDy={pt.handleOut.dy}
                dotHalfSize={handleDotHalf}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (e.nativeEvent.button !== 0) return;
                  e.stopPropagation();
                  onHandleDown(i, 'out', e.point.x, e.point.y);
                }}
              />
            )}

            {/* Vertex circle */}
            <mesh
              position={[pt.x, pt.y, Z]}
              renderOrder={OVERLAY_RENDER_ORDER + 1}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (e.nativeEvent.button !== 0) return;
                e.stopPropagation();
                onPointDown(i, e.point.x, e.point.y);
              }}
            >
              <circleGeometry args={[vertexRadius, CIRCLE_SEGMENTS]} />
              <meshBasicMaterial color={isSelected ? ACCENT_COLOR : WHITE} depthTest={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Handle Line Sub-Component ──────────────────────────────────────────────

interface HandleLineProps {
  readonly pointX: number;
  readonly pointY: number;
  readonly handleDx: number;
  readonly handleDy: number;
  readonly dotHalfSize: number;
  readonly onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

function HandleLine({
  pointX,
  pointY,
  handleDx,
  handleDy,
  dotHalfSize,
  onPointerDown,
}: HandleLineProps) {
  const handleX = pointX + handleDx;
  const handleY = pointY + handleDy;

  // Dashed line from handle endpoint to vertex
  const lineObj = useMemo(() => {
    const points = [new THREE.Vector3(handleX, handleY, Z), new THREE.Vector3(pointX, pointY, Z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 1,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = OVERLAY_RENDER_ORDER;
    return line;
  }, [pointX, pointY, handleX, handleY]);

  return (
    <>
      {/* Handle dashed line */}
      <primitive object={lineObj} />

      {/* Handle dot (small square) */}
      <mesh
        position={[handleX, handleY, Z]}
        renderOrder={OVERLAY_RENDER_ORDER + 1}
        onPointerDown={onPointerDown}
      >
        <planeGeometry args={[dotHalfSize * 2, dotHalfSize * 2]} />
        <meshBasicMaterial color={HANDLE_DOT_COLOR} depthTest={false} />
      </mesh>
    </>
  );
}
