import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useThree } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import { OrthographicCamera, Vector3 as Vector3Impl } from 'three';
import { CAMERA_FOV } from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { partFootprint } from '@/shared/types/assemblyPlacement';
import { distanceToOrthoZoom } from '@/shared/utils/cameraProjection';
import { storeToScene, type PlacedPart } from './workshopPlacement';

/** Screen-space rectangle in canvas-relative CSS pixels. */
export interface MarqueeRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function InvalidateBridge({
  invalidateRef,
}: {
  invalidateRef: RefObject<(() => void) | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate, invalidateRef]);
  return null;
}

/** Projects part centers to canvas pixels so the DOM marquee can pick them. */
export function ScenePickBridge({
  pickRef,
  placements,
  flatFrameRef,
  baseW,
  baseD,
}: {
  pickRef: RefObject<((rect: MarqueeRect) => string[]) | null>;
  placements: PlacedPart[];
  flatFrameRef: RefObject<Group | null>;
  baseW: number;
  baseD: number;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    pickRef.current = (rect: MarqueeRect): string[] => {
      const point = new Vector3Impl();
      const ids = new Set<string>();
      for (const placed of placements) {
        point.set(
          storeToScene(placed.x, baseW),
          storeToScene(placed.y, baseD),
          (placed.z + placed.topZ) / 2
        );
        flatFrameRef.current?.localToWorld(point);
        point.project(camera);
        const sx = (point.x * 0.5 + 0.5) * size.width;
        const sy = (1 - (point.y * 0.5 + 0.5)) * size.height;
        if (sx >= rect.minX && sx <= rect.maxX && sy >= rect.minY && sy <= rect.maxY) {
          ids.add(placed.selectId);
        }
      }
      return [...ids];
    };
    return () => {
      pickRef.current = null;
    };
  }, [baseD, baseW, camera, flatFrameRef, pickRef, placements, size.height, size.width]);
  return null;
}

const FRAME_MS = 350;

const FRAME_FILL = 0.65;

/**
 * Zoom-to-selection: tween the orbit target to the selection's center and
 * the camera to a distance that fits its bounding sphere, keeping the
 * current view direction. No selection frames the whole build.
 */
export function FrameSelectionBridge({
  frameRef,
  controlsRef,
  placements,
  flatFrameRef,
  baseW,
  baseD,
}: {
  frameRef: RefObject<(() => void) | null>;
  controlsRef?: RefObject<OrbitControlsType | null>;
  placements: PlacedPart[];
  flatFrameRef: RefObject<Group | null>;
  baseW: number;
  baseD: number;
}) {
  const { camera, invalidate, size } = useThree();
  const animRef = useRef<number | null>(null);
  const placementsRef = useRef(placements);
  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  const frame = useCallback((): void => {
    const controls = controlsRef?.current;
    if (!controls) return;
    const selection = new Set(useDesignerStore.getState().ui.selectedAssemblyPartIds);
    const all = placementsRef.current;
    const targets = selection.size > 0 ? all.filter((p) => selection.has(p.selectId)) : all;

    let center: Vector3;
    let radius: number;
    if (targets.length === 0) {
      center = new Vector3Impl(0, 0, 10);
      radius = Math.hypot(baseW, baseD) / 2;
    } else {
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;
      for (const placed of targets) {
        const footprint = partFootprint(placed.node);
        const half = Math.max(footprint.w, footprint.d) / 2;
        minX = Math.min(minX, storeToScene(placed.x, baseW) - half);
        maxX = Math.max(maxX, storeToScene(placed.x, baseW) + half);
        minY = Math.min(minY, storeToScene(placed.y, baseD) - half);
        maxY = Math.max(maxY, storeToScene(placed.y, baseD) + half);
        minZ = Math.min(minZ, placed.z);
        maxZ = Math.max(maxZ, placed.topZ);
      }
      center = new Vector3Impl((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      radius = Math.max(10, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2);
    }
    flatFrameRef.current?.localToWorld(center);

    const halfFovRad = (CAMERA_FOV / 2) * (Math.PI / 180);
    const distance = (radius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const targetPos = direction.multiplyScalar(distance).add(center);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const ortho = camera instanceof OrthographicCamera ? camera : null;
    const startZoom = ortho?.zoom ?? 1;
    const targetZoom =
      ortho && size.height > 0 ? distanceToOrthoZoom(distance, CAMERA_FOV, size.height) : 1;
    const startTime = performance.now();
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const step = (): void => {
      const progress = Math.min((performance.now() - startTime) / FRAME_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPos, targetPos, eased);
      controls.target.lerpVectors(startTarget, center, eased);
      if (ortho) {
        ortho.zoom = startZoom + (targetZoom - startZoom) * eased;
        ortho.updateProjectionMatrix();
      }
      controls.update();
      invalidate();
      animRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    step();
  }, [baseD, baseW, camera, controlsRef, flatFrameRef, invalidate, size.height]);

  useEffect(() => {
    frameRef.current = frame;
    return () => {
      frameRef.current = null;
    };
  }, [frame, frameRef]);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      frame();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [frame]);

  useEffect(
    () => () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    },
    []
  );
  return null;
}
