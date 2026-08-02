import type { Draft } from 'immer';
import type { DesignerState } from '@/features/bin-designer/types';

/** Zustand immer `set` — receives a mutator that operates on the mutable draft. */
export type Set = (fn: (state: Draft<DesignerState>) => void) => void;
/** Zustand `get` — returns the current immutable state snapshot. */
export type Get = () => DesignerState;
