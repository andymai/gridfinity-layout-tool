/**
 * Camera + container state for the cutout workspace canvas.
 *
 * Holds the lightweight zoom/pan mirror that the rulers and header read.
 * The R3F `OrthographicCamera` inside the Canvas is the source of truth at
 * runtime, but this hook gives the surrounding chrome a synchronized view
 * for rulers, percentage display, and wheel-zoom centered on the cursor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  FIT_PADDING,
} from '../panel/CutoutsSection/renderer/constants';

export interface CutoutWorkspaceCamera {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  containerSize: { width: number; height: number };
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  cameraCenter: { x: number; y: number };
  // Pan handlers in `useCutoutWorkspacePointer` need to nudge the camera
  // center, so this setter must remain exposed. `setZoom`/`defaultZoom`
  // stay internal — callers should go through zoomIn/zoomOut/fitToView/
  // handleWheel so the cursor-centered compensation logic isn't bypassed.
  setCameraCenter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  zoomPercent: number;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  handleWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export function useCutoutWorkspaceCamera(
  binWidth: number,
  binDepth: number
): CutoutWorkspaceCamera {
  // Measure canvas container dynamically
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasWidth = containerSize.width;
  const canvasHeight = containerSize.height;

  // Lightweight zoom state for rulers & header (mirrors camera zoom)
  const defaultZoom = useMemo(() => {
    const pad = 1 - 2 * FIT_PADDING;
    return Math.min((canvasWidth * pad) / binWidth, (canvasHeight * pad) / binDepth, MAX_ZOOM);
  }, [canvasWidth, canvasHeight, binWidth, binDepth]);

  const [zoom, setZoom] = useState(defaultZoom);
  const [cameraCenter, setCameraCenter] = useState({ x: binWidth / 2, y: binDepth / 2 });

  // Re-fit camera when bin dimensions or container size change
  /* eslint-disable react-hooks/set-state-in-effect -- syncing camera to external bin dimension changes from designer store */
  useEffect(() => {
    setZoom(defaultZoom);
    setCameraCenter({ x: binWidth / 2, y: binDepth / 2 });
  }, [defaultZoom, binWidth, binDepth]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fitToView = useCallback(() => {
    const pad = 1 - 2 * FIT_PADDING;
    const newZoom = Math.min(
      (canvasWidth * pad) / binWidth,
      (canvasHeight * pad) / binDepth,
      MAX_ZOOM
    );
    setZoom(newZoom);
    setCameraCenter({ x: binWidth / 2, y: binDepth / 2 });
  }, [canvasWidth, canvasHeight, binWidth, binDepth]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  const zoomPercent = Math.round((zoom / defaultZoom) * 100);

  // Wheel zoom — zoom toward the cursor's world position
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      if (newZoom === zoom) return;

      // Cursor position in screen pixels relative to the container
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Cursor in world coordinates (before zoom change)
      const worldX = cameraCenter.x + (cx - canvasWidth / 2) / zoom;
      const worldY = cameraCenter.y - (cy - canvasHeight / 2) / zoom;

      // After zoom, same screen pixel should map to same world point
      setCameraCenter({
        x: worldX - (cx - canvasWidth / 2) / newZoom,
        y: worldY + (cy - canvasHeight / 2) / newZoom,
      });
      setZoom(newZoom);
    },
    [zoom, cameraCenter, canvasWidth, canvasHeight]
  );

  return {
    canvasContainerRef,
    containerSize,
    canvasWidth,
    canvasHeight,
    zoom,
    cameraCenter,
    setCameraCenter,
    zoomPercent,
    zoomIn,
    zoomOut,
    fitToView,
    handleWheel,
  };
}
