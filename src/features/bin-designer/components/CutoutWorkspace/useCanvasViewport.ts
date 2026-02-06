/**
 * Hook managing zoom/pan state for the cutout workspace canvas.
 *
 * Computes a SVG viewBox string from zoom level and pan offset.
 * Zoom is cursor-centered; pan supports middle-click and space-drag.
 */

import { useState, useCallback, useMemo } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 1.25;

interface UseCanvasViewportOptions {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly scale: number;
}

export function useCanvasViewport({ canvasWidth, canvasHeight, scale }: UseCanvasViewportOptions) {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Compute viewBox from zoom and pan
  const viewBox = useMemo(() => {
    const vbWidth = canvasWidth / zoom;
    const vbHeight = canvasHeight / zoom;
    const vbX = -panOffset.x * scale;
    const vbY = -panOffset.y * scale;
    return `${vbX} ${vbY} ${vbWidth} ${vbHeight}`;
  }, [zoom, panOffset, canvasWidth, canvasHeight, scale]);

  const fitToView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  /** Handle wheel events for zoom toward cursor */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      if (newZoom === zoom) return;

      // Zoom toward cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      // Convert cursor from screen px to mm-space
      const cursorMmX = cursorX / scale / zoom - panOffset.x;
      const cursorMmY = cursorY / scale / zoom - panOffset.y;
      // After zoom, the same cursor position should map to the same mm point
      const newPanX = cursorX / scale / newZoom - cursorMmX;
      const newPanY = cursorY / scale / newZoom - cursorMmY;

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    },
    [zoom, panOffset, scale]
  );

  /** Pan by delta in screen pixels */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      setPanOffset((prev) => ({
        x: prev.x + dx / scale / zoom,
        y: prev.y + dy / scale / zoom,
      }));
    },
    [scale, zoom]
  );

  const zoomPercent = Math.round(zoom * 100);

  return {
    zoom,
    panOffset,
    viewBox,
    zoomPercent,
    fitToView,
    zoomIn,
    zoomOut,
    handleWheel,
    panBy,
  };
}
