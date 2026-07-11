/**
 * Resolves the active layout's baseplate pointer against the global library on
 * mount and whenever the active layout changes. Three outcomes:
 *
 * - **Auto-seed** (migration): the layout has `baseplateParams` but no
 *   `activeBaseplateId` — create a library design from those params and point
 *   the layout at it.
 * - **Re-materialize**: `activeBaseplateId` still resolves to a library design —
 *   copy the design's (possibly edited-elsewhere) params back into the layout so
 *   shared edits propagate on load.
 * - **Orphan**: `activeBaseplateId` is set but the design is gone (deleted on
 *   another device) — drop the pointer to null, keeping the inline copy.
 *
 * The synchronous store `importLayout` can't touch IndexedDB, so this hook owns
 * the async backfill. Mirrors `bin-designer/hooks/useDesignerInit`. Idempotent:
 * resolves once per active layout id, so a double-mount is safe.
 */

import { useEffect, useRef } from 'react';
import { isOk } from '@/core/result';
import { useLayoutStore } from '@/core/store/layout';
import type { LayoutId, StoredBaseplateParams } from '@/core/types';
import {
  saveDesign,
  loadDesign,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import { loadRegistry, upsertRegistryEntry } from '@/features/baseplate/store/baseplateRegistry';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Order-independent structural equality for JSON-shaped param objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

/** Next free "Baseplate N" name given the current registry entries. */
function nextBaseplateName(): string {
  const used = new Set(
    loadRegistry()
      .map((ref) => /^Baseplate (\d+)$/.exec(ref.name)?.[1])
      .filter((match): match is string => match !== undefined)
      .map((n) => Number.parseInt(n, 10))
  );
  let n = 1;
  while (used.has(n)) n += 1;
  return `Baseplate ${n}`;
}

export function useBaseplateLibraryInit(): void {
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);

  // Resolve once per active layout. `undefined` = never resolved; `null` is a
  // valid activeLayoutId (unsaved layout), so it can't double as the sentinel.
  const resolvedFor = useRef<LayoutId | null | undefined>(undefined);
  const inProgress = useRef(false);

  useEffect(() => {
    // Returns true once the target layout is resolved (or has nothing to do);
    // false if the active layout changed mid-await so the caller can retry the
    // now-current layout instead.
    const resolve = async (targetLayoutId: LayoutId | null): Promise<boolean> => {
      // Load-time resolution must not create undo entries, so it writes through
      // the non-undoable local store action rather than the CQRS command.
      const setActiveBaseplateLocal = useLayoutStore.getState().setActiveBaseplateLocal;
      const layout = useLayoutStore.getState().layout;
      const params: StoredBaseplateParams | undefined = layout.baseplateParams;
      const activeId = layout.activeBaseplateId ?? null;

      // The active layout can switch while IndexedDB awaits below; bail before
      // any write if it did, so this layout's baseplate never lands on another.
      const isStale = (): boolean => useLayoutStore.getState().activeLayoutId !== targetLayoutId;

      if (params) {
        if (activeId === null) {
          const saved = await saveDesign({
            name: nextBaseplateName(),
            params,
            thumbnail: null,
          });
          if (isStale()) return false;
          if (isOk(saved)) {
            upsertRegistryEntry({
              id: saved.value.id,
              name: saved.value.name,
              updatedAt: saved.value.updatedAt,
            });
            setActiveDesignId(saved.value.id);
            setActiveBaseplateLocal(saved.value.id, saved.value.params);
          }
        } else {
          const loaded = await loadDesign(activeId);
          if (isStale()) return false;
          if (isOk(loaded)) {
            setActiveDesignId(activeId);
            if (!deepEqual(loaded.value.params, params)) {
              setActiveBaseplateLocal(activeId, loaded.value.params);
            }
          } else if (loaded.error.code === 'STORAGE_NOT_FOUND') {
            // Only orphan when the design is genuinely gone (deleted on another
            // device). A transient read failure (IDB unavailable/corrupt) keeps
            // the pointer so a later retry can still resolve it.
            setActiveBaseplateLocal(null, params);
          }
        }
      }

      return true;
    };

    const run = (): void => {
      if (inProgress.current) return;
      const targetLayoutId = useLayoutStore.getState().activeLayoutId;
      if (resolvedFor.current === targetLayoutId) return;
      inProgress.current = true;
      void resolve(targetLayoutId)
        .then((resolved) => {
          if (resolved) resolvedFor.current = targetLayoutId;
        })
        .catch(() => {
          // Give up on this layout rather than hot-loop on a persistent IDB
          // failure; a later layout switch re-triggers resolution.
          resolvedFor.current = targetLayoutId;
        })
        .finally(() => {
          inProgress.current = false;
          // A layout switch mid-await skips its own effect run (inProgress was
          // set), so re-run here to resolve whatever is active now.
          run();
        });
    };

    run();
  }, [activeLayoutId]);
}
