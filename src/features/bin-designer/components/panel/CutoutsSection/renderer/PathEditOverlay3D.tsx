/**
 * WebGL overlay for pen tool vertex editing.
 *
 * Shows interactive vertex circles and bezier control handle lines/dots
 * when editing a committed path cutout. Figma-quality handles with
 * white fill, colored border, hover scale, and visible handles for all points.
 * Screen-space sizing via camera zoom. World coordinates: mm, Y-up.
 */

import { useState, useMemo, useCallback } from 'react';
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
const HANDLE_LINE_COLOR = new THREE.Color('#a0a0a0');
const Z = 0.05;

// Figma-quality handle sizes (screen pixels)
const VERTEX_OUTER_RADIUS_PX = 5; // Outer border circle
const VERTEX_INNER_RADIUS_PX = 3.5; // Inner fill circle
const HANDLE_DOT_OUTER_RADIUS_PX = 4;
const HANDLE_DOT_INNER_RADIUS_PX = 2.5;
const HOVER_SCALE = 1.25;
const CIRCLE_SEGMENTS = 24; // Smoother circles

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
  const vOuter = VERTEX_OUTER_RADIUS_PX / zoom;
  const vInner = VERTEX_INNER_RADIUS_PX / zoom;
  const hOuter = HANDLE_DOT_OUTER_RADIUS_PX / zoom;
  const hInner = HANDLE_DOT_INNER_RADIUS_PX / zoom;

  return (
    <group renderOrder={OVERLAY_RENDER_ORDER}>
      {path.map((pt, i) => {
        const isSelected = selectedPointIndex === i;
        const showHandles = true; // All handles visible in edit mode (Figma behavior)

        return (
          <group key={i}>
            {/* Handle lines and dots (visible for selected vertex) */}
            {showHandles && pt.handleIn && (
              <HandleLine
                pointX={pt.x}
                pointY={pt.y}
                handleDx={pt.handleIn.dx}
                handleDy={pt.handleIn.dy}
                outerRadius={hOuter}
                innerRadius={hInner}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (e.nativeEvent.button !== 0) return;
                  e.stopPropagation();
                  onHandleDown(i, 'in', e.point.x, e.point.y);
                }}
              />
            )}
            {showHandles && pt.handleOut && (
              <HandleLine
                pointX={pt.x}
                pointY={pt.y}
                handleDx={pt.handleOut.dx}
                handleDy={pt.handleOut.dy}
                outerRadius={hOuter}
                innerRadius={hInner}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (e.nativeEvent.button !== 0) return;
                  e.stopPropagation();
                  onHandleDown(i, 'out', e.point.x, e.point.y);
                }}
              />
            )}

            {/* Vertex anchor — white fill with colored border, Figma-style */}
            <VertexHandle
              x={pt.x}
              y={pt.y}
              outerRadius={vOuter}
              innerRadius={vInner}
              isSelected={isSelected}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (e.nativeEvent.button !== 0) return;
                e.stopPropagation();
                onPointDown(i, e.point.x, e.point.y);
              }}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── Vertex Handle ──────────────────────────────────────────────────────────

interface VertexHandleProps {
  readonly x: number;
  readonly y: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly isSelected: boolean;
  readonly onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

function VertexHandle({
  x,
  y,
  outerRadius,
  innerRadius,
  isSelected,
  onPointerDown,
}: VertexHandleProps) {
  const [hovered, setHovered] = useState(false);
  const scale = hovered ? HOVER_SCALE : 1;

  const outerGeo = useMemo(
    () => new THREE.CircleGeometry(outerRadius, CIRCLE_SEGMENTS),
    [outerRadius]
  );
  const innerGeo = useMemo(
    () => new THREE.CircleGeometry(innerRadius, CIRCLE_SEGMENTS),
    [innerRadius]
  );

  const borderColor = isSelected ? ACCENT_COLOR : ACCENT_COLOR;

  return (
    <group
      position={[x, y, Z]}
      scale={[scale, scale, 1]}
      onPointerDown={onPointerDown}
      onPointerEnter={useCallback(() => setHovered(true), [])}
      onPointerLeave={useCallback(() => setHovered(false), [])}
    >
      {/* Outer border circle */}
      <mesh geometry={outerGeo} renderOrder={OVERLAY_RENDER_ORDER + 1}>
        <meshBasicMaterial color={borderColor} depthTest={false} />
      </mesh>
      {/* Inner fill circle */}
      <mesh geometry={innerGeo} renderOrder={OVERLAY_RENDER_ORDER + 2} position={[0, 0, 0.001]}>
        <meshBasicMaterial color={isSelected ? ACCENT_COLOR : WHITE} depthTest={false} />
      </mesh>
    </group>
  );
}

// ─── Handle Line Sub-Component ──────────────────────────────────────────────

interface HandleLineProps {
  readonly pointX: number;
  readonly pointY: number;
  readonly handleDx: number;
  readonly handleDy: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

function HandleLine({
  pointX,
  pointY,
  handleDx,
  handleDy,
  outerRadius,
  innerRadius,
  onPointerDown,
}: HandleLineProps) {
  const [hovered, setHovered] = useState(false);
  const handleX = pointX + handleDx;
  const handleY = pointY + handleDy;
  const scale = hovered ? HOVER_SCALE : 1;

  // Solid thin line from anchor to handle endpoint
  const lineObj = useMemo(() => {
    const pts = [new THREE.Vector3(handleX, handleY, Z), new THREE.Vector3(pointX, pointY, Z)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: HANDLE_LINE_COLOR,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = OVERLAY_RENDER_ORDER;
    return obj;
  }, [pointX, pointY, handleX, handleY]);

  const outerGeo = useMemo(
    () => new THREE.CircleGeometry(outerRadius, CIRCLE_SEGMENTS),
    [outerRadius]
  );
  const innerGeo = useMemo(
    () => new THREE.CircleGeometry(innerRadius, CIRCLE_SEGMENTS),
    [innerRadius]
  );

  return (
    <>
      {/* Solid handle line (not dashed — cleaner) */}
      <primitive object={lineObj} />

      {/* Handle dot — circle with border, Figma-style */}
      <group
        position={[handleX, handleY, Z]}
        scale={[scale, scale, 1]}
        onPointerDown={onPointerDown}
        onPointerEnter={useCallback(() => setHovered(true), [])}
        onPointerLeave={useCallback(() => setHovered(false), [])}
      >
        <mesh geometry={outerGeo} renderOrder={OVERLAY_RENDER_ORDER + 1}>
          <meshBasicMaterial color={ACCENT_COLOR} depthTest={false} />
        </mesh>
        <mesh geometry={innerGeo} renderOrder={OVERLAY_RENDER_ORDER + 2} position={[0, 0, 0.001]}>
          <meshBasicMaterial color={WHITE} depthTest={false} />
        </mesh>
      </group>
    </>
  );
}
