/**
 * Resolves the active layout's baseplate pointer against the global library on
 * mount and whenever the active layout changes. Three outcomes:
 *
 * - **Auto-seed** (migration): the layout has `baseplateParams` but no
 *   `activeBaseplateId` — create a library design from those params and point
 *   the layout at it.
 * - **Auto-create** (`{ autoCreate: true }`, /baseplate only): the layout has
 *   neither — create a design from the defaults.
 * - **Re-materialize**: `activeBaseplateId` still resolves to a library design —
 *   copy the design's (possibly edited on another device) params back into the
 *   layout. A design an older layout also links is first split off into this
 *   layout's own copy, keeping this layout's params.
 * - **Orphan**: `activeBaseplateId` is set but the design is gone (deleted on
 *   another device) — drop the pointer to null, keeping the inline copy.
 *
 * Auto-create is what guarantees an active design always exists, which is what
 * lets the /baseplate header drop Save / Save As / New and match the bin
 * designer (see the feature README). It is opt-in because this hook also mounts
 * on the planner (`BaseplateLibraryInitMount`): creating there would mint a
 * library entry for every layout on load, whether or not its owner ever opened
 * the baseplate tool. Gating it on the route means an entry appears when
 * someone actually uses the tool.
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
  deleteDesign,
  updateDesignParams,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import { loadRegistry, upsertRegistryEntry } from '@/features/baseplate/store/baseplateRegistry';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { nextBaseplateName } from '@/features/baseplate/utils/baseplateName';
import {
  designOwner,
  ownedCopyId,
  ownedCopyName,
} from '@/features/baseplate/utils/designOwnership';
import { findDesignUsers } from '@/features/baseplate/utils/designUsers';

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

export interface UseBaseplateLibraryInitOptions {
  /** Create a default design when the layout has no baseplate at all. /baseplate only. */
  readonly autoCreate?: boolean;
}

/**
 * `(layout, design)` pairs already materialized into the layout this session.
 * Re-materialize adopts the library's params on a layout's FIRST resolve of a
 * design (a fresh load, picking up cross-device edits); on later mounts (tab
 * navigation) the layout's inline params are the newest truth, so re-copying the
 * design — which may not yet reflect a just-made, debounce-pending edit — would
 * silently drop it. Keyed by layout AND design so a different
 * layout that shares the design still gets its own required first sync.
 * Module-scoped so it survives the hook's per-route remounts.
 */
const materializedThisSession = new Set<string>();

/** Session key for {@link materializedThisSession}; `null` layout id is a valid
 * (unsaved) layout, distinct from any real id. */
function materializeKey(layoutId: LayoutId | null, designId: string): string {
  return `${layoutId ?? '\u0000'}:${designId}`;
}

export function useBaseplateLibraryInit(options?: UseBaseplateLibraryInitOptions): void {
  const autoCreate = options?.autoCreate ?? false;
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
      // This hook mounts lazily, so the read can land well after the user has
      // edited the plate or picked another design. What they did meanwhile is
      // newer than anything captured above and must not be written over.
      const current = (): {
        activeId: string | null;
        params: StoredBaseplateParams | undefined;
      } => {
        const now = useLayoutStore.getState().layout;
        return { activeId: now.activeBaseplateId ?? null, params: now.baseplateParams };
      };

      if (activeId === null) {
        // Nothing to resolve: no design, no params, and not the route that
        // wants one created.
        if (!params && !autoCreate) return true;

        // Auto-seed uses the layout's own params; auto-create falls back to the
        // defaults. Never adopt another design here — baseplateParams live on
        // the Layout, so adopting would overwrite settings this layout has.
        const seedParams: StoredBaseplateParams = params ?? DEFAULT_BASEPLATE_PARAMS;
        const saved = await saveDesign({
          name: nextBaseplateName(loadRegistry()),
          params: seedParams,
          thumbnail: null,
        });
        if (isStale()) return false;
        if (isOk(saved)) {
          let design = saved.value;
          // Each catch-up write is itself an await another edit can land in, so
          // repeat until the stored design matches what the layout holds.
          for (let attempt = 0; attempt < 5; attempt++) {
            const edited = current().params;
            if (edited === undefined || deepEqual(edited, design.params)) break;
            const updated = await updateDesignParams(design.id, edited);
            if (isStale()) return false;
            if (!isOk(updated)) break;
            design = updated.value;
          }
          // Linking a design that holds older params would let the next
          // session's first resolve restore them over the edit; unlinked, that
          // session seeds again from what the layout holds.
          const latest = current();
          const caughtUp =
            latest.params === undefined
              ? params === undefined
              : deepEqual(latest.params, design.params);
          if (latest.activeId !== null || !caughtUp) {
            const removed = await deleteDesign(design.id);
            // Unregistered, a seed the delete missed would sit in IndexedDB where
            // no list shows it; registered, the library offers it for deletion.
            if (!isOk(removed) && removed.error.code !== 'STORAGE_NOT_FOUND') {
              upsertRegistryEntry({
                id: design.id,
                name: design.name,
                updatedAt: design.updatedAt,
              });
            }
            return true;
          }
          upsertRegistryEntry({ id: design.id, name: design.name, updatedAt: design.updatedAt });
          setActiveDesignId(design.id);
          setActiveBaseplateLocal(design.id, latest.params ?? design.params);
          // The layout now mirrors the freshly created design, so a later mount
          // must not re-copy over a subsequent edit.
          materializedThisSession.add(materializeKey(targetLayoutId, design.id));
        }
      } else if (params) {
        const loaded = await loadDesign(activeId);
        if (isStale()) return false;
        const now = current();
        if (now.activeId !== activeId) return true;
        if (isOk(loaded)) {
          setActiveDesignId(activeId);
          // Adopt the library's params only on THIS layout's first resolve of
          // the design this session (see `materializedThisSession`); later
          // mounts keep the layout's newer inline params. Keyed by layout too,
          // so a different layout sharing the design still gets its first sync.
          const key = materializeKey(targetLayoutId, activeId);
          if (!materializedThisSession.has(key)) {
            // A design an older layout also uses stays with that layout; this
            // one takes its own copy of what it shows now.
            if (targetLayoutId !== null) {
              const users = await findDesignUsers(activeId);
              if (isStale()) return false;
              if (current().activeId !== activeId) return true;
              const owner = designOwner(users);
              if (users.length > 1 && owner !== undefined && owner.id !== targetLayoutId) {
                const copy = await saveDesign({
                  id: ownedCopyId(targetLayoutId, activeId),
                  name: ownedCopyName(loaded.value.name, useLayoutStore.getState().layout.name),
                  params: current().params ?? params,
                  thumbnail: loaded.value.thumbnail,
                });
                if (isStale()) return false;
                const latest = current();
                if (latest.activeId !== activeId) return true;
                if (isOk(copy)) {
                  upsertRegistryEntry({
                    id: copy.value.id,
                    name: copy.value.name,
                    updatedAt: copy.value.updatedAt,
                  });
                  setActiveDesignId(copy.value.id);
                  setActiveBaseplateLocal(copy.value.id, latest.params ?? copy.value.params);
                  materializedThisSession.add(materializeKey(targetLayoutId, copy.value.id));
                  if (latest.params !== undefined && !deepEqual(latest.params, copy.value.params)) {
                    await updateDesignParams(copy.value.id, latest.params);
                  }
                  return true;
                }
                // No copy, so adopting the shared params would overwrite what
                // this layout shows. Left unmaterialized, the next resolve
                // tries the split again.
                return true;
              }
            }
            // Reference, not value: an edit undone to its original value is
            // still the user's latest word on the plate.
            if (current().params === params && !deepEqual(loaded.value.params, params)) {
              setActiveBaseplateLocal(activeId, loaded.value.params);
            }
            materializedThisSession.add(key);
          }
        } else if (loaded.error.code === 'STORAGE_NOT_FOUND') {
          // Only orphan when the design is genuinely gone (deleted on another
          // device). A transient read failure (IDB unavailable/corrupt) keeps
          // the pointer so a later retry can still resolve it.
          setActiveBaseplateLocal(null, now.params ?? params);
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
  }, [activeLayoutId, autoCreate]);
}
