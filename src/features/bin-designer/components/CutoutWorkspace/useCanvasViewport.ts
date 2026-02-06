/**
 * Hook managing zoom/pan state for the cutout workspace canvas.
 *
 * Uses a viewOrigin model: the viewBox top-left corner is tracked in SVG
 * pixel coordinates. The bin content lives at (0,0)→(binW×scale, binD×scale)
 * within the SVG coordinate space, and the viewBox window controls what's visible.
 */

import { useState, useCallback, useMemo } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 1.25;
/** Fraction of canvas to leave as padding around the bin */
const FIT_PADDING = 0.08;

interface UseCanvasViewportOptions {
  /** Container width in CSS pixels (SVG element fills this) */
  readonly canvasWidth: number;
  /** Container height in CSS pixels (SVG element fills this) */
  readonly canvasHeight: number;
  /** Conversion factor: mm → SVG pixels */
  readonly scale: number;
  readonly binWidth: number;
  readonly binDepth: number;
}

export function useCanvasViewport({
  canvasWidth,
  canvasHeight,
  scale,
  binWidth,
  binDepth,
}: UseCanvasViewportOptions) {
  const [zoom, setZoom] = useState(1);
  /** Top-left corner of the viewBox in SVG pixel coordinates */
  const [viewOrigin, setViewOrigin] = useState({ x: 0, y: 0 });

  // Compute viewBox from zoom and viewOrigin
  const viewBox = useMemo(() => {
    const w = canvasWidth / zoom;
    const h = canvasHeight / zoom;
    return `${viewOrigin.x} ${viewOrigin.y} ${w} ${h}`;
  }, [zoom, viewOrigin, canvasWidth, canvasHeight]);

  const fitToView = useCallback(() => {
    const binPxW = binWidth * scale;
    const binPxH = binDepth * scale;
    if (binPxW <= 0 || binPxH <= 0) {
      setZoom(1);
      setViewOrigin({ x: 0, y: 0 });
      return;
    }
    const pad = 1 - 2 * FIT_PADDING;
    const z = Math.min((canvasWidth * pad) / binPxW, (canvasHeight * pad) / binPxH, MAX_ZOOM);
    // Center the bin in the viewBox
    const vbW = canvasWidth / z;
    const vbH = canvasHeight / z;
    setZoom(z);
    setViewOrigin({
      x: (binPxW - vbW) / 2,
      y: (binPxH - vbH) / 2,
    });
  }, [binWidth, binDepth, canvasWidth, canvasHeight, scale]);

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

      // Cursor position in screen pixels relative to the SVG element
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Cursor in SVG coordinates (before zoom change)
      const svgX = viewOrigin.x + cx / zoom;
      const svgY = viewOrigin.y + cy / zoom;

      // After zoom, the same screen position should map to the same SVG point
      setZoom(newZoom);
      setViewOrigin({
        x: svgX - cx / newZoom,
        y: svgY - cy / newZoom,
      });
    },
    [zoom, viewOrigin]
  );

  /** Pan by delta in screen pixels */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      setViewOrigin((prev) => ({
        x: prev.x - dx / zoom,
        y: prev.y - dy / zoom,
      }));
    },
    [zoom]
  );

  // Ruler sync: convert viewOrigin (SVG px) to mm-space offsets
  const rulerPanX = -viewOrigin.x / scale;
  const rulerPanY = -viewOrigin.y / scale;

  const zoomPercent = Math.round(zoom * 100);

  return {
    zoom,
    viewOrigin,
    viewBox,
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
