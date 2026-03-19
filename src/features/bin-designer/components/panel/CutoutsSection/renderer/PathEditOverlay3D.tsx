/**
 * WebGL overlay for pen tool vertex editing.
 *
 * Shows interactive vertex circles and bezier control handle lines/dots
 * when editing a committed path cutout. Figma-quality handles with
 * white fill, colored border, hover scale, and visible handles for all points.
 * Screen-space sizing via camera zoom. World coordinates: mm, Y-up.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { SegmentHoverInfo } from '../handlers';
import { flattenSegment } from '../pathGeometry';
import { RENDER_ORDER } from './constants';

interface PathEditOverlay3DProps {
  readonly cutout: Cutout;
  readonly selectedPointIndex: number | null;
  readonly previewOverrides?: Partial<Cutout>;
  readonly segmentHover?: SegmentHoverInfo | null;
  readonly onPointDown: (index: number, mmX: number, mmY: number) => void;
  readonly onHandleDown: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
}

/** Figma-style handle colors: saturated blue border, white fill */
const HANDLE_BORDER = new THREE.Color('#0d99ff');
const HANDLE_FILL = new THREE.Color('#ffffff');
const HANDLE_SELECTED_FILL = new THREE.Color('#0d99ff');
const HANDLE_LINE_COLOR = new THREE.Color('#0d99ff');
const Z = 0.05;

// Handle sizes (screen pixels) — matches Figma/Illustrator proportions
const VERTEX_OUTER_RADIUS_PX = 5;
const VERTEX_INNER_RADIUS_PX = 3;
const HANDLE_DOT_OUTER_RADIUS_PX = 4;
const HANDLE_DOT_INNER_RADIUS_PX = 2.5;
const HOVER_SCALE = 1.2;
const CIRCLE_SEGMENTS = 24;

const GHOST_DOT_RADIUS_PX = 4;
const OVERLAY_RENDER_ORDER = RENDER_ORDER.HANDLES + 10;

export function PathEditOverlay3D({
  cutout,
  selectedPointIndex,
  previewOverrides,
  segmentHover,
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
        // All handles visible in edit mode (Figma behavior)

        return (
          <group key={i}>
            {/* Handle lines and dots (visible for selected vertex) */}
            {pt.handleIn && (
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
            {pt.handleOut && (
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

      {/* Segment hover: highlighted segment + ghost dot */}
      {segmentHover && (
        <SegmentHoverPreview
          path={path}
          hover={segmentHover}
          ghostRadius={GHOST_DOT_RADIUS_PX / zoom}
        />
      )}
    </group>
  );
}
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

  return (
    <group
      position={[x, y, Z]}
      scale={[scale, scale, 1]}
      onPointerDown={onPointerDown}
      onPointerEnter={useCallback(() => setHovered(true), [])}
      onPointerLeave={useCallback(() => setHovered(false), [])}
    >
      {/* Blue border — Figma-style, always visible on any background */}
      <mesh geometry={outerGeo} renderOrder={OVERLAY_RENDER_ORDER + 1}>
        <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={1} depthTest={false} />
      </mesh>
      {/* White fill, solid blue when selected */}
      <mesh geometry={innerGeo} renderOrder={OVERLAY_RENDER_ORDER + 2} position={[0, 0, 0.001]}>
        <meshBasicMaterial
          color={isSelected ? HANDLE_SELECTED_FILL : HANDLE_FILL}
          transparent
          opacity={1}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
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

  const lineObj = useMemo(() => {
    const pts = [new THREE.Vector3(handleX, handleY, Z), new THREE.Vector3(pointX, pointY, Z)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: HANDLE_LINE_COLOR,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = OVERLAY_RENDER_ORDER;
    return obj;
  }, [pointX, pointY, handleX, handleY]);

  useEffect(() => {
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj]);

  const outerGeo = useMemo(
    () => new THREE.CircleGeometry(outerRadius, CIRCLE_SEGMENTS),
    [outerRadius]
  );
  const innerGeo = useMemo(
    () => new THREE.CircleGeometry(innerRadius, CIRCLE_SEGMENTS),
    [innerRadius]
  );

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

  return (
    <>
      <primitive object={lineObj} />
      <group
        position={[handleX, handleY, Z]}
        scale={[scale, scale, 1]}
        onPointerDown={onPointerDown}
        onPointerEnter={useCallback(() => setHovered(true), [])}
        onPointerLeave={useCallback(() => setHovered(false), [])}
      >
        {/* Blue border */}
        <mesh geometry={outerGeo} renderOrder={OVERLAY_RENDER_ORDER + 1}>
          <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={1} depthTest={false} />
        </mesh>
        {/* White fill */}
        <mesh geometry={innerGeo} renderOrder={OVERLAY_RENDER_ORDER + 2} position={[0, 0, 0.001]}>
          <meshBasicMaterial color={HANDLE_FILL} transparent opacity={1} depthTest={false} />
        </mesh>
      </group>
    </>
  );
}
interface SegmentHoverPreviewProps {
  readonly path: readonly PathPoint[];
  readonly hover: SegmentHoverInfo;
  readonly ghostRadius: number;
}

function SegmentHoverPreview({ path, hover, ghostRadius }: SegmentHoverPreviewProps) {
  // Highlighted segment polyline
  const segLineObj = useMemo(() => {
    const segPts = flattenSegment(path, hover.segmentIndex);
    const vecs = segPts.map((p) => new THREE.Vector3(p.x, p.y, Z));
    const geo = new THREE.BufferGeometry().setFromPoints(vecs);
    const mat = new THREE.LineBasicMaterial({
      color: HANDLE_BORDER,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = OVERLAY_RENDER_ORDER - 1;
    return obj;
  }, [path, hover.segmentIndex]);

  // Ghost dot geometry
  const ghostGeo = useMemo(
    () => new THREE.CircleGeometry(ghostRadius, CIRCLE_SEGMENTS),
    [ghostRadius]
  );

  return (
    <>
      {/* Highlighted segment */}
      <primitive object={segLineObj} />

      {/* Ghost dot at insertion point */}
      <mesh position={[hover.x, hover.y, Z]} renderOrder={OVERLAY_RENDER_ORDER + 3}>
        <primitive object={ghostGeo} attach="geometry" />
        <meshBasicMaterial color={HANDLE_BORDER} transparent opacity={0.5} depthTest={false} />
      </mesh>
    </>
  );
}
