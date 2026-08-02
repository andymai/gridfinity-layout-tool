/**
 * Param slice: bin parameters, scoped updaters, compartments, surface text,
 * inserts, wall pattern. Composed from cohesive action sub-factories that
 * share the `pushHistoryEntry` helper (see ../../helpers.ts).
 */

import { createCoreParamActions } from './coreParamActions';
import { createScopedUpdaters } from './scopedUpdaters';
import { createCompartmentActions } from './compartmentActions';
import { createSurfaceTextActions } from './surfaceTextActions';
import { createInsertActions } from './insertActions';
import type { Set, Get } from './types';

export function createParamSlice(set: Set, get: Get) {
  return {
    ...createCoreParamActions(set, get),
    ...createScopedUpdaters(set),
    ...createCompartmentActions(set, get),
    ...createSurfaceTextActions(set, get),
    ...createInsertActions(set),
  };
}
