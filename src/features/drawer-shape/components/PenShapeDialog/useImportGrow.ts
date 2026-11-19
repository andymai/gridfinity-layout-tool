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
 * Grid units one axis grows to on Apply. `importUnits`, from the import the
 * sketch came from, counts while the sketch passes the grid, the test its
 * prompt made.
 */
export function applyGrowUnits(current: number, axis: SketchAxis, importUnits?: number): number {
  return Math.max(
    current,
    axis.bbox > axis.bound ? unitsFor(axis.bbox, axis.pitch) : 0,
    importUnits !== undefined && axis.bbox > axis.grid ? importUnits : 0
  );
}

/**
 * Holds the drawer size an oversize import asks for until the import commits
 * its sketch, which then carries it to Apply. Cancel keeps the drawer.
 */
export function useImportGrow() {
  const pending = useRef<Sketch['grow']>(undefined);
  const onGrowDrawer = useCallback((width: number, depth: number) => {
    pending.current = { width, depth };
  }, []);
  const take = useCallback((): Sketch['grow'] => {
    const grow = pending.current;
    pending.current = undefined;
    return grow;
  }, []);
  return { onGrowDrawer, take };
}
