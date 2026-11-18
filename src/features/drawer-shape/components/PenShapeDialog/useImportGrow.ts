import { useCallback, useRef } from 'react';
import { unitsFor } from '../../utils/outlineImport/fitLoop';
import type { Sketch } from './usePenSketch';

/** One axis of the sketch against the drawer, in mm. */
export interface SketchAxis {
  readonly bbox: number;
  /** The measured drawer, or the grid without one: a sketch past it grows the grid. */
  readonly bound: number;
  readonly grid: number;
  readonly pitch: number;
}

/**
 * Grid units one axis grows to on Apply. `importUnits`, from an import still in
 * the sketch, counts while the sketch passes the grid, the test its prompt made.
 */
export function applyGrowUnits(current: number, axis: SketchAxis, importUnits?: number): number {
  return Math.max(
    current,
    axis.bbox > axis.bound ? unitsFor(axis.bbox, axis.pitch) : 0,
    importUnits !== undefined && axis.bbox > axis.grid ? importUnits : 0
  );
}

interface ImportGrow {
  readonly width: number;
  readonly depth: number;
  readonly session: unknown;
  sketch: Sketch | null;
}

/**
 * The drawer sizes that oversize imports ask for, held until Apply so Cancel
 * keeps the drawer. The newest request whose import Undo has not taken back
 * stands; every request lapses with the open session.
 */
export function useImportGrow(session: unknown, holds: (sketch: Sketch) => boolean) {
  const ref = useRef<ImportGrow[]>([]);
  const onGrowDrawer = useCallback(
    (width: number, depth: number) => {
      const kept = ref.current.filter((grow) => grow.session === session);
      ref.current = [...kept, { width, depth, session, sketch: null }];
    },
    [session]
  );
  const onImported = useCallback(
    (sketch: Sketch) => {
      const last = ref.current.at(-1);
      if (last !== undefined && last.session === session && last.sketch === null) {
        last.sketch = sketch;
      }
    },
    [session]
  );
  const standing = useCallback(
    (): ImportGrow | null =>
      [...ref.current]
        .reverse()
        .find((grow) => grow.session === session && grow.sketch !== null && holds(grow.sketch)) ??
      null,
    [session, holds]
  );
  return { onGrowDrawer, onImported, standing };
}
