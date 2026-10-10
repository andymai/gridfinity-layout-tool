import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';

export interface LayoutPrintBed {
  readonly printBedSize: number;
  /** `undefined` is a square bed: resolve it to `printBedSize`. */
  readonly printBedDepth: number | undefined;
}

// The bed belongs to the active layout, shared with the planner, the baseplate
// and the layout ZIP. `settings.defaultPrintBedSize` only seeds new layouts, so
// reading it here splits a bin against a bed the user never chose.
export function useLayoutPrintBed(): LayoutPrintBed {
  return useLayoutStore(
    useShallow((s) => ({
      printBedSize: s.layout.printBedSize,
      printBedDepth: s.layout.printBedDepth,
    }))
  );
}
