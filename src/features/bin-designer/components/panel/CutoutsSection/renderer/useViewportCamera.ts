/**
 * Hook managing OrthographicCamera zoom/pan for the cutout workspace.
 *
 * Replaces useCanvasViewport — same external API but drives a Three.js
 * OrthographicCamera instead of SVG viewBox manipulation.
 *
 * World coordinates are mm, Y-up (matching the bin model coordinate system).
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, FIT_PADDING } from './constants';

interface UseViewportCameraOptions {
  /** Bin interior width in mm */
  readonly binWidth: number;
  /** Bin interior depth in mm */
  readonly binDepth: number;
}

export function useViewportCamera({ binWidth, binDepth }: UseViewportCameraOptions) {
  const { camera, invalidate, size } = useThree();
  /** Counter to trigger re-renders when camera zoom changes (value not used directly) */
  const [, setRenderTick] = useState(0);
  const triggerRender = useCallback(() => setRenderTick((n) => n + 1), []);
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Sync zoom state from camera
  const zoom = camera.zoom;

  const fitToView = useCallback(() => {
    const cam = cameraRef.current;
    if (binWidth <= 0 || binDepth <= 0) return;

    const pad = 1 - 2 * FIT_PADDING;
    const zoomX = (size.width * pad) / binWidth;
    const zoomY = (size.height * pad) / binDepth;
    const newZoom = Math.min(zoomX, zoomY, MAX_ZOOM);

    cam.zoom = newZoom;
    cam.position.set(binWidth / 2, binDepth / 2, 100);
    cam.updateProjectionMatrix();
    triggerRender();
    invalidate();
  }, [binWidth, binDepth, size.width, size.height, invalidate, triggerRender]);

  const zoomIn = useCallback(() => {
    const cam = cameraRef.current;
    const newZoom = Math.min(MAX_ZOOM, cam.zoom * ZOOM_STEP);
    cam.zoom = newZoom;
    cam.updateProjectionMatrix();
    triggerRender();
    invalidate();
  }, [invalidate, triggerRender]);

  const zoomOut = useCallback(() => {
    const cam = cameraRef.current;
    const newZoom = Math.max(MIN_ZOOM, cam.zoom / ZOOM_STEP);
    cam.zoom = newZoom;
    cam.updateProjectionMatrix();
    triggerRender();
    invalidate();
  }, [invalidate, triggerRender]);

  /** Handle wheel events for zoom toward cursor. Called from the container div. */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
      if (newZoom === cam.zoom) return;

      // Cursor position relative to the canvas element
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Cursor in world coordinates (before zoom change)
      // Screen center maps to camera.position, offset by half-viewport / zoom
      const worldX = cam.position.x + (cx - size.width / 2) / cam.zoom;
      const worldY = cam.position.y - (cy - size.height / 2) / cam.zoom;

      // After zoom, same screen pixel should map to same world point
      // worldX = cam.position.x + (cx - size.width/2) / newZoom
      // => cam.position.x = worldX - (cx - size.width/2) / newZoom
      cam.position.x = worldX - (cx - size.width / 2) / newZoom;
      cam.position.y = worldY + (cy - size.height / 2) / newZoom;
      cam.zoom = newZoom;
      cam.updateProjectionMatrix();
      triggerRender();
      invalidate();
    },
    [size.width, size.height, invalidate, triggerRender]
  );

  /** Pan by delta in screen pixels */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const cam = cameraRef.current;
      cam.position.x -= dx / cam.zoom;
      cam.position.y += dy / cam.zoom; // Screen Y is inverted vs world Y
      cam.updateProjectionMatrix();
      invalidate();
    },
    [invalidate]
  );

  // Ruler sync: compute mm-space offsets from camera position
  // The camera looks at (cam.position.x, cam.position.y)
  // The visible left edge in world mm is: cam.position.x - size.width / (2 * zoom)
  // The ruler panOffset represents how far the origin is offset from the ruler start
  const rulerPanX = useMemo(() => {
    const leftEdge = camera.position.x - size.width / (2 * zoom);
    return -leftEdge;
  }, [camera.position.x, size.width, zoom]);

  const rulerPanY = useMemo(() => {
    // The visible top edge in world coordinates (top = max Y due to Y-up)
    const topEdge = camera.position.y + size.height / (2 * zoom);
    // For the left ruler, panOffset = how far the bin extent is from the top of the ruler
    // The ruler renders extent at the top, 0 at the bottom
    return topEdge - binDepth;
  }, [camera.position.y, size.height, zoom, binDepth]);

  const zoomPercent = Math.round(zoom * 100);

  return {
    zoom,
    zoomPercent,
    fitToView,
    zoomIn,
    zoomOut,
    handleWheel,
    panBy,
    rulerPanX,
    rulerPanY,
  };
}

/**
 * Standalone version for components outside the R3F tree (e.g., CutoutEditor sidebar).
 * Stores viewport state without requiring useThree().
 */
export function useViewportCameraStandalone({
  binWidth,
  binDepth,
  canvasWidth,
  canvasHeight,
}: {
  binWidth: number;
  binDepth: number;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [cameraPos, setCameraPos] = useState({ x: binWidth / 2, y: binDepth / 2 });
  const invalidateRef = useRef<(() => void) | null>(null);

  // Auto-center on bin size changes
  /* eslint-disable react-hooks/set-state-in-effect -- syncing camera position to external bin dimension changes */
  useEffect(() => {
    setCameraPos({ x: binWidth / 2, y: binDepth / 2 });
  }, [binWidth, binDepth]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fitToView = useCallback(() => {
    if (binWidth <= 0 || binDepth <= 0) return;
    const pad = 1 - 2 * FIT_PADDING;
    const zoomX = (canvasWidth * pad) / binWidth;
    const zoomY = (canvasHeight * pad) / binDepth;
    const newZoom = Math.min(zoomX, zoomY, MAX_ZOOM);
    setZoom(newZoom);
    setCameraPos({ x: binWidth / 2, y: binDepth / 2 });
    invalidateRef.current?.();
  }, [binWidth, binDepth, canvasWidth, canvasHeight]);

  const zoomPercent = Math.round(zoom * 100);

  return {
    zoom,
    cameraPos,
    zoomPercent,
    fitToView,
    invalidateRef,
  };
}
