/**
 * Recovery effects for the cutout interaction state machine.
 *
 * Listens for `pointercancel`, `blur`, and `visibilitychange` to drop
 * preview/drag state when the user backgrounds the tab, switches windows,
 * or otherwise loses pointer capture mid-interaction. Also clears ruler
 * measurement when leaving ruler modes.
 */

import { useEffect } from 'react';
import type { CutoutShape } from '@/features/bin-designer/types';
import type { PathDrawingPreviewState } from './handlers';
import type { RulerMeasurement } from './handlers/rulerHandler';
import type { InteractionMode, PreviewMap } from './cutoutInteractionTypes';
import type { AlignmentGuide } from './geometry';

interface DrawingPreviewState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShape;
}

interface UseCutoutRecoveryOptions {
  readonly mode: InteractionMode;
  readonly setMode: (next: InteractionMode) => void;
  readonly setPreview: (next: PreviewMap) => void;
  readonly setActiveGuides: (next: AlignmentGuide[]) => void;
  readonly setDrawingPreview: (next: DrawingPreviewState | null) => void;
  readonly setPathDrawingPreview: (next: PathDrawingPreviewState | null) => void;
  readonly setRulerMeasurement: (next: RulerMeasurement | null) => void;
}

export function useCutoutRecovery({
  mode,
  setMode,
  setPreview,
  setActiveGuides,
  setDrawingPreview,
  setPathDrawingPreview,
  setRulerMeasurement,
}: UseCutoutRecoveryOptions): void {
  useEffect(() => {
    const reset = () => {
      if (mode.type === 'path-drawing' && mode.activePointDrag) {
        // Cancel in-progress handle drag but preserve the placed path points
        setMode({ ...mode, activePointDrag: false, repositionIndex: null });
        return;
      }
      if (
        mode.type !== 'idle' &&
        mode.type !== 'placing' &&
        mode.type !== 'marquee' &&
        mode.type !== 'vertex-editing' &&
        mode.type !== 'path-drawing' &&
        mode.type !== 'ruler-ready'
      ) {
        setPreview(new Map());
        setActiveGuides([]);
        setDrawingPreview(null);
        setPathDrawingPreview(null);
        setRulerMeasurement(null);
        setMode({ type: 'idle' });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') reset();
    };
    window.addEventListener('pointercancel', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pointercancel', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    mode,
    setMode,
    setPreview,
    setActiveGuides,
    setDrawingPreview,
    setPathDrawingPreview,
    setRulerMeasurement,
  ]);

  // Clear ruler measurement when leaving ruler modes (e.g. pressing Escape)
  useEffect(() => {
    if (mode.type !== 'measuring' && mode.type !== 'ruler-ready') {
      setRulerMeasurement(null);
    }
  }, [mode.type, setRulerMeasurement]);
}
