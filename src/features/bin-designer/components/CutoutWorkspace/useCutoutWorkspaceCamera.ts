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

/**
 * One wheel notch on a traditional mouse, in CSS pixels. Browsers report ~100
 * or 120 for a notch, so a mouse still moves one {@link ZOOM_STEP} per click.
 */
const WHEEL_PIXELS_PER_STEP = 120;

/** A single event may not move more than this many steps, whatever it claims. */
const MAX_WHEEL_STEPS = 2;

/** Fallback line height (px) for `deltaMode: 'line'` — Firefox's default. */
const WHEEL_LINE_HEIGHT_PX = 16;

/**
 * Zoom multiplier for one wheel event, PROPORTIONAL to how far the wheel
 * actually moved.
 *
 * A fixed step per event is right for a mouse, whose notches are discrete, and
 * badly wrong for a trackpad, which fires a stream of small deltas: a single
 * two-finger flick became a dozen 1.25x multiplications and shot past whatever
 * the user was aiming at. Normalising by {@link WHEEL_PIXELS_PER_STEP} leaves
 * the mouse exactly where it was and makes the trackpad continuous.
 *
 * `deltaMode` has to be honoured or the normalisation inverts the problem:
 * Firefox reports LINE units (~3 per notch), which as raw pixels would be
 * almost no zoom at all.
 */
function wheelZoomFactor(e: React.WheelEvent<HTMLDivElement>, canvasHeight: number): number {
  const perUnitPx = e.deltaMode === 1 ? WHEEL_LINE_HEIGHT_PX : e.deltaMode === 2 ? canvasHeight : 1;
  const steps = (e.deltaY * perUnitPx) / WHEEL_PIXELS_PER_STEP;
  const clamped = Math.max(-MAX_WHEEL_STEPS, Math.min(MAX_WHEEL_STEPS, steps));
  return Math.pow(ZOOM_STEP, -clamped);
}

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
  const [cameraCenter, setCameraCenterState] = useState({ x: binWidth / 2, y: binDepth / 2 });

  /**
   * Set once the user has framed the view themselves, and the reason the
   * auto-fit below is conditional.
   *
   * `defaultZoom` is derived from the CONTAINER, so it moves whenever the
   * container does — dragging the split divider beside the canvas, collapsing
   * the inspector dock, resizing the window. Re-fitting on every one of those
   * threw away the zoom and pan the user had just set up, which is the
   * "zooming repositions the view" loop: you can never keep a corner of a
   * large bin on screen while you work on it.
   */
  const userFramedRef = useRef(false);

  const setCameraCenter = useCallback<CutoutWorkspaceCamera['setCameraCenter']>((next) => {
    userFramedRef.current = true;
    setCameraCenterState(next);
  }, []);

  // A different bin is a different subject: its old framing means nothing, so
  // the view is handed back to the auto-fit. Runs before the fit effect below
  // in the same commit, so a bin change re-fits in one pass.
  useEffect(() => {
    userFramedRef.current = false;
  }, [binWidth, binDepth]);

  // Auto-fit only while the user has not taken over.
  useEffect(() => {
    if (userFramedRef.current) return;
    setZoom(defaultZoom);
    setCameraCenterState({ x: binWidth / 2, y: binDepth / 2 });
  }, [defaultZoom, binWidth, binDepth]);

  // The explicit way back: hands the view to the auto-fit again, so a later
  // container resize re-frames rather than preserving a framing the user has
  // just discarded.
  const fitToView = useCallback(() => {
    const pad = 1 - 2 * FIT_PADDING;
    const newZoom = Math.min(
      (canvasWidth * pad) / binWidth,
      (canvasHeight * pad) / binDepth,
      MAX_ZOOM
    );
    userFramedRef.current = false;
    setZoom(newZoom);
    setCameraCenterState({ x: binWidth / 2, y: binDepth / 2 });
  }, [canvasWidth, canvasHeight, binWidth, binDepth]);

  const zoomIn = useCallback(() => {
    userFramedRef.current = true;
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    userFramedRef.current = true;
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  const zoomPercent = Math.round((zoom / defaultZoom) * 100);

  // Wheel zoom — zoom toward the cursor's world position
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = wheelZoomFactor(e, canvasHeight);
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      if (newZoom === zoom) return;
      userFramedRef.current = true;

      // Cursor position in screen pixels relative to the container
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Cursor in world coordinates (before zoom change)
      const worldX = cameraCenter.x + (cx - canvasWidth / 2) / zoom;
      const worldY = cameraCenter.y - (cy - canvasHeight / 2) / zoom;

      // After zoom, same screen pixel should map to same world point
      setCameraCenterState({
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
