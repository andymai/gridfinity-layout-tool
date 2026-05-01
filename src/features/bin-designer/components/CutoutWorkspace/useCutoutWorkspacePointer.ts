/**
 * Pointer + marquee + pan handlers for the cutout workspace canvas.
 *
 * Owns:
 *   - marquee selection state (mm world coords)
 *   - middle-click and Space-to-pan refs
 *   - cursor world position for the coordinate display
 *   - keyboard shortcuts: Space (pan), Ctrl/Cmd+0 (fit-to-view)
 *
 * Routes pointer events through the interaction state machine
 * (`useCutoutInteraction`) when the current mode is non-idle, otherwise
 * falls through to marquee selection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import type { InteractionMode } from '../panel/CutoutsSection/cutoutInteractionTypes';

interface UseCutoutWorkspacePointerArgs {
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  cutouts: Cutout[];
  selectCutout: (id: string, additive: boolean) => void;
  deselectAll: () => void;
  handlePointerMove: (worldX: number, worldY: number, shift: boolean, alt: boolean) => void;
  handlePointerUp: () => void;
  handlePathBackgroundDown: (worldX: number, worldY: number, shift: boolean) => void;
  handleVertexBackgroundDown: (worldX: number, worldY: number) => void;
  zoom: number;
  setCameraCenter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  fitToView: () => void;
}

interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CutoutWorkspacePointer {
  marquee: MarqueeRect | null;
  spaceHeld: boolean;
  cursorWorldPos: { x: number; y: number } | null;
  handleBackgroundPointerDown: (worldX: number, worldY: number, nativeEvent: PointerEvent) => void;
  handleCanvasPointerMove: (worldX: number, worldY: number, nativeEvent: PointerEvent) => void;
  handleCanvasPointerUp: () => void;
}

export function useCutoutWorkspacePointer({
  mode,
  setMode,
  cutouts,
  selectCutout,
  deselectAll,
  handlePointerMove,
  handlePointerUp,
  handlePathBackgroundDown,
  handleVertexBackgroundDown,
  zoom,
  setCameraCenter,
  fitToView,
}: UseCutoutWorkspacePointerArgs): CutoutWorkspacePointer {
  // Marquee state — in mm world coordinates (no SVG pixel conversion needed)
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Middle-click pan state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Space-to-pan state
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spacePanRef = useRef(false);

  // Cursor world position for coordinate display
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);

  // Keyboard shortcuts: Space-to-pan, Ctrl+0 fit-to-view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToView();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        spacePanRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fitToView]);

  // Background click handler — receives world-space mm coords from R3F
  const handleBackgroundPointerDown = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      // Middle-click starts pan
      if (nativeEvent.button === 1) {
        nativeEvent.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        return;
      }

      // Space+click starts pan
      if (spaceHeld && nativeEvent.button === 0) {
        nativeEvent.preventDefault();
        spacePanRef.current = true;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        return;
      }

      // Ruler tool: sticky mode (toolbar) or Shift+drag quick measurement
      if (mode.type === 'ruler-ready' || (nativeEvent.shiftKey && mode.type === 'idle')) {
        const sticky = mode.type === 'ruler-ready';
        setMode({ type: 'measuring', startX: worldX, startY: worldY, sticky });
        return;
      }

      // Path tool: start or continue path drawing
      if ((mode.type === 'placing' && mode.shape === 'path') || mode.type === 'path-drawing') {
        handlePathBackgroundDown(worldX, worldY, nativeEvent.shiftKey);
        return;
      }

      // Vertex editing: try segment hit-test for point insertion, deselect on miss
      if (mode.type === 'vertex-editing') {
        handleVertexBackgroundDown(worldX, worldY);
        return;
      }

      if (mode.type === 'placing') {
        setMode({ type: 'pending-place', shape: mode.shape, startMmX: worldX, startMmY: worldY });
        return;
      }

      deselectAll();
      // Marquee in mm world coords
      marqueeStartRef.current = { x: worldX, y: worldY };
      setMarquee({ x: worldX, y: worldY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll, spaceHeld, handlePathBackgroundDown, handleVertexBackgroundDown]
  );

  // Pointer move — receives world-space mm coords from R3F
  const handleCanvasPointerMove = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      // Track cursor world position for coordinate display
      setCursorWorldPos({ x: worldX, y: worldY });

      // Handle middle-click or space pan
      if (isPanningRef.current || spacePanRef.current) {
        const dx = nativeEvent.clientX - panStartRef.current.x;
        const dy = nativeEvent.clientY - panStartRef.current.y;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        // Pan: adjust camera center
        setCameraCenter((prev) => ({
          x: prev.x - dx / zoom,
          y: prev.y + dy / zoom,
        }));
        return;
      }

      if (
        mode.type === 'pending-place' ||
        mode.type === 'dragging' ||
        mode.type === 'resizing' ||
        mode.type === 'rotating' ||
        mode.type === 'group-rotating' ||
        mode.type === 'group-scaling' ||
        mode.type === 'drawing' ||
        mode.type === 'path-drawing' ||
        mode.type === 'vertex-editing' ||
        mode.type === 'measuring'
      ) {
        handlePointerMove(worldX, worldY, nativeEvent.shiftKey, nativeEvent.altKey);
        return;
      }

      // Marquee update — in mm world coords
      if (!marqueeStartRef.current) return;
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: worldX - marqueeStartRef.current.x,
        h: worldY - marqueeStartRef.current.y,
      });
    },
    [mode, handlePointerMove, zoom, setCameraCenter]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    if (spacePanRef.current) {
      spacePanRef.current = false;
      return;
    }

    if (
      mode.type === 'pending-place' ||
      mode.type === 'dragging' ||
      mode.type === 'resizing' ||
      mode.type === 'rotating' ||
      mode.type === 'group-rotating' ||
      mode.type === 'group-scaling' ||
      mode.type === 'drawing' ||
      mode.type === 'path-drawing' ||
      mode.type === 'vertex-editing' ||
      mode.type === 'measuring'
    ) {
      handlePointerUp();
      return;
    }

    // Marquee selection — coordinates are already in mm world space
    if (marquee && marqueeStartRef.current) {
      const mmLeft = Math.min(marquee.x, marquee.x + marquee.w);
      const mmRight = Math.max(marquee.x, marquee.x + marquee.w);
      const mmBottom = Math.min(marquee.y, marquee.y + marquee.h);
      const mmTop = Math.max(marquee.y, marquee.y + marquee.h);

      const mw = mmRight - mmLeft;
      const mh = mmTop - mmBottom;

      if (mw + mh > 2) {
        for (const cutout of cutouts) {
          const cRight = cutout.x + cutout.width;
          const cTop = cutout.y + cutout.depth;
          if (cutout.x < mmRight && cRight > mmLeft && cutout.y < mmTop && cTop > mmBottom) {
            selectCutout(cutout.id, true);
          }
        }
      }
    }

    marqueeStartRef.current = null;
    setMarquee(null);
  }, [mode, handlePointerUp, marquee, cutouts, selectCutout]);

  return {
    marquee,
    spaceHeld,
    cursorWorldPos,
    handleBackgroundPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}
