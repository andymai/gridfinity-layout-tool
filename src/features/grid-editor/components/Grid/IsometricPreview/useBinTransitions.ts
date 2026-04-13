import { useCallback, useState, useLayoutEffect, useSyncExternalStore } from 'react';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';

// ── Spring constants ──────────────────────────────────────────────────
/** Spring stiffness — higher = faster snap. */
export const SPRING_STIFFNESS = 180;
/** Spring damping — lower = bouncier. Damping ratio ~0.45 (underdamped). */
export const SPRING_DAMPING = 12;
/** Height (grid units) from which entering bins drop. */
export const DROP_HEIGHT = 2.0;
/** Duration of exit animation in seconds. */
export const EXIT_DURATION_S = 0.2;
/** Final scale of exiting bins (before removal). */
export const EXIT_MIN_SCALE = 0.3;
/** Per-bin stagger delay for bulk operations (seconds). */
export const STAGGER_DELAY_S = 0.04;
/** Threshold to consider entering spring settled. */
const POS_SNAP = 0.001;
/** Velocity threshold to consider entering spring settled. */
const VEL_SNAP = 0.01;

// ── Types ────────────────────────────────────────────────────────────��

interface EnterTransition {
  phase: 'entering';
  /** Current spring offset above target z (starts at DROP_HEIGHT, settles to 0). */
  springPos: number;
  /** Current spring velocity. */
  springVel: number;
  /** Seconds to wait before animation starts (stagger). */
  staggerDelay: number;
  /** Elapsed time since transition was created (seconds). */
  elapsed: number;
}

interface ExitTransition {
  phase: 'exiting';
  /** Current scale factor (1 → EXIT_MIN_SCALE). */
  scale: number;
  /** Current opacity (1 → 0). */
  opacity: number;
  /** Seconds to wait before animation starts (stagger). */
  staggerDelay: number;
  /** Elapsed time since transition was created (seconds). */
  elapsed: number;
}

export type BinTransition = EnterTransition | ExitTransition;

interface TransitionEntry {
  binData: BinRenderData;
  transition: BinTransition;
}

export interface TransitioningBin {
  binData: BinRenderData;
  transition: BinTransition;
}

interface TransitionSnapshot {
  stableBins: BinRenderData[];
  enteringBins: TransitioningBin[];
  exitingGhosts: TransitioningBin[];
}

export interface BinTransitionResult extends TransitionSnapshot {
  /** Call from useFrame to advance all animations by `delta` seconds. */
  tick: (delta: number) => boolean;
}

// ── Spring step (exported for testing) ────────────────────────────────

export function stepSpring(pos: number, vel: number, dt: number): { pos: number; vel: number } {
  const accel = -SPRING_STIFFNESS * pos - SPRING_DAMPING * vel;
  const newVel = vel + accel * dt;
  const newPos = pos + newVel * dt;
  return { pos: newPos, vel: newVel };
}

// ── Transition Store ───────────────────────────────��──────────────────

interface TransitionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TransitionSnapshot;
  updateBins: (bins: BinRenderData[], reducedMotion: boolean) => void;
  tick: (delta: number) => boolean;
}

const EMPTY_SNAPSHOT: TransitionSnapshot = {
  stableBins: [],
  enteringBins: [],
  exitingGhosts: [],
};

function computeSnapshot(
  binsToRender: BinRenderData[],
  transitions: Map<string, TransitionEntry>
): TransitionSnapshot {
  const currentBinMap = new Map<string, BinRenderData>();
  for (const bd of binsToRender) {
    currentBinMap.set(bd.bin.id, bd);
  }

  const stableBins: BinRenderData[] = [];
  for (const bd of binsToRender) {
    if (!transitions.has(bd.bin.id)) {
      stableBins.push(bd);
    }
  }

  const enteringBins: TransitioningBin[] = [];
  const exitingGhosts: TransitioningBin[] = [];
  for (const entry of transitions.values()) {
    if (entry.transition.phase === 'entering') {
      const freshData = currentBinMap.get(entry.binData.bin.id);
      enteringBins.push({
        binData: freshData ?? entry.binData,
        transition: entry.transition,
      });
    } else {
      exitingGhosts.push(entry);
    }
  }

  return { stableBins, enteringBins, exitingGhosts };
}

function createTransitionStore(): TransitionStore {
  let prevBinIds = new Set<string>();
  let currentBins: BinRenderData[] = [];
  const transitions = new Map<string, TransitionEntry>();
  let snapshot: TransitionSnapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function rebuildSnapshot(): void {
    snapshot = computeSnapshot(currentBins, transitions);
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    updateBins(bins: BinRenderData[], reducedMotion: boolean) {
      currentBins = bins;

      const currentIds = new Set<string>();
      const currentMap = new Map<string, BinRenderData>();
      for (const bd of bins) {
        currentIds.add(bd.bin.id);
        currentMap.set(bd.bin.id, bd);
      }

      const isInitialMount = prevBinIds.size === 0 && currentIds.size > 0;

      // Detect layout switch: overlap < 20% of total → skip animations.
      let isLayoutSwitch = false;
      if (!isInitialMount && prevBinIds.size > 0 && currentIds.size > 0) {
        let overlap = 0;
        for (const id of currentIds) {
          if (prevBinIds.has(id)) overlap++;
        }
        const total = Math.max(prevBinIds.size, currentIds.size);
        isLayoutSwitch = overlap / total < 0.2;
      }

      const shouldAnimate = !reducedMotion && !isInitialMount && !isLayoutSwitch;

      if (shouldAnimate) {
        // Find new bins (in current but not in previous).
        let enterIndex = 0;
        for (const [id, bd] of currentMap) {
          if (!prevBinIds.has(id) && !transitions.has(id)) {
            transitions.set(id, {
              binData: bd,
              transition: {
                phase: 'entering',
                springPos: DROP_HEIGHT,
                springVel: 0,
                staggerDelay: enterIndex * STAGGER_DELAY_S,
                elapsed: 0,
              },
            });
            enterIndex++;
          }
        }

        // Find removed bins (in previous but not in current).
        let exitIndex = 0;
        for (const id of prevBinIds) {
          if (!currentIds.has(id)) {
            const existing = transitions.get(id);
            if (existing && existing.transition.phase === 'entering') {
              // Was entering — flip to exiting.
              transitions.set(id, {
                binData: existing.binData,
                transition: {
                  phase: 'exiting',
                  scale: 1,
                  opacity: 1,
                  staggerDelay: exitIndex * STAGGER_DELAY_S,
                  elapsed: 0,
                },
              });
            } else if (!existing) {
              // Need the previous bin data for the ghost. Look it up from
              // the snapshot's entering/exiting arrays or from a stored copy.
              // Since prevBinIds doesn't store BinRenderData, we need to find
              // the bin data from the old snapshot or transitions.
              const prevBinData =
                snapshot.stableBins.find((b) => b.bin.id === id) ??
                snapshot.enteringBins.find((b) => b.binData.bin.id === id)?.binData;
              if (prevBinData) {
                transitions.set(id, {
                  binData: prevBinData,
                  transition: {
                    phase: 'exiting',
                    scale: 1,
                    opacity: 1,
                    staggerDelay: exitIndex * STAGGER_DELAY_S,
                    elapsed: 0,
                  },
                });
              }
            }
            exitIndex++;
          }
        }

        // Handle re-added bins (currently exiting but now present again).
        for (const [id, bd] of currentMap) {
          const existing = transitions.get(id);
          if (existing && existing.transition.phase === 'exiting') {
            transitions.set(id, {
              binData: bd,
              transition: {
                phase: 'entering',
                springPos: DROP_HEIGHT,
                springVel: 0,
                staggerDelay: 0,
                elapsed: 0,
              },
            });
          }
        }
      } else {
        // No animation — clear any lingering transitions.
        transitions.clear();
      }

      prevBinIds = currentIds;
      rebuildSnapshot();
      notify();
    },

    tick(delta: number): boolean {
      if (transitions.size === 0) return false;

      let anyActive = false;
      const toRemove: string[] = [];

      for (const [id, entry] of transitions) {
        const t = entry.transition;
        t.elapsed += delta;

        if (t.phase === 'entering') {
          if (t.elapsed < t.staggerDelay) {
            anyActive = true;
            continue;
          }
          const activeDt = Math.min(delta, t.elapsed - t.staggerDelay);
          const step = stepSpring(t.springPos, t.springVel, activeDt);
          t.springPos = step.pos;
          t.springVel = step.vel;

          if (Math.abs(t.springPos) < POS_SNAP && Math.abs(t.springVel) < VEL_SNAP) {
            t.springPos = 0;
            t.springVel = 0;
            toRemove.push(id);
          } else {
            anyActive = true;
          }
        } else {
          // Exiting
          if (t.elapsed < t.staggerDelay) {
            anyActive = true;
            continue;
          }
          const activeElapsed = t.elapsed - t.staggerDelay;
          const progress = Math.min(activeElapsed / EXIT_DURATION_S, 1);
          t.scale = 1 - progress * (1 - EXIT_MIN_SCALE);
          t.opacity = 1 - progress;

          if (progress >= 1) {
            toRemove.push(id);
          } else {
            anyActive = true;
          }
        }
      }

      for (const id of toRemove) {
        transitions.delete(id);
      }

      // Re-render only when transitions complete (bins move to stableBins).
      // During animation, AnimatedBinMesh reads mutated props directly in useFrame.
      if (toRemove.length > 0) {
        rebuildSnapshot();
        notify();
      }

      return anyActive || toRemove.length > 0;
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────

/**
 * Tracks bin additions and removals across renders, producing three lists:
 * stable bins (for MergedBinMeshes), entering bins (spring drop), and
 * exiting ghosts (shrink+fade). Call `tick(delta)` inside useFrame to
 * advance all animations.
 *
 * Transition state lives in an external store (plain closure) to satisfy
 * the React Compiler's ref-access and immutability rules. React subscribes
 * to snapshot changes via `useSyncExternalStore`.
 */
export function useBinTransitions(
  binsToRender: BinRenderData[],
  reducedMotion: boolean
): BinTransitionResult {
  const [store] = useState(createTransitionStore);

  // Update store when bins change (synchronous, before paint).
  useLayoutEffect(() => {
    store.updateBins(binsToRender, reducedMotion);
  }, [store, binsToRender, reducedMotion]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  // Stable tick reference — delegates to the store's tick method.
  const tick = useCallback((delta: number): boolean => store.tick(delta), [store]);

  return {
    ...snapshot,
    tick,
  };
}
