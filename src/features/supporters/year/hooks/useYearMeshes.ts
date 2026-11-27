import { useEffect, useState } from 'react';
import { bridgeManager, getActiveKernel, type GenerationBridge } from '@/shared/generation/bridge';
import {
  binMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
} from '@/shared/generation/meshPersistence';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import type { MeshData } from '@/shared/types/generation';
import { knifeRestMatedOffset, planKnifeRest } from '@/shared/utils/knifeRestPlan';
import type { YearBinRef } from '../types';
import { isKernelCached } from '../utils/kernelCache';
import { meshTriangles } from '../utils/meshTriangles';

export interface YearMesh {
  readonly mesh: MeshData;
  readonly triangles: number;
  /** Where a companion knife rest stands, in the block's centred frame (mm). */
  readonly restOffset?: { readonly x: number; readonly y: number };
}

type Params = YearBinRef['params'];

/**
 * The bridge's own timeout never drops below 30 s, and a cancel cannot stop a
 * WASM call in progress, so a slow design is cut off by resetting the worker.
 */
const GENERATION_LIMIT_MS = 20_000;

/** A result to show nowhere and keep nowhere: a pocket's mesh file has not arrived. */
const NOT_YET = 'not-yet';

/** Per session, so a replay or a return from the credits generates nothing twice. */
const session = new Map<string, YearMesh | null>();

function yearMesh(mesh: MeshData, params: Params): YearMesh {
  const rest = mesh.knifeRestMesh ? planKnifeRest(params) : null;
  return {
    mesh,
    triangles: meshTriangles(mesh),
    ...(rest ? { restOffset: knifeRestMatedOffset(params, rest) } : {}),
  };
}

async function generateWithin(
  bridge: GenerationBridge,
  params: Params,
  key: string
): Promise<YearMesh | null | typeof NOT_YET> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), GENERATION_LIMIT_MS);
  });
  try {
    const result = await Promise.race([bridge.generateImmediate(params), limit]);
    if (result === 'timeout') {
      // The cancel clears the request's own watchdog, which would otherwise
      // fire later and reset the replacement worker too.
      bridge.cancel();
      bridge.hardResetWorker('Your 2026 cut off a slow design');
      return null;
    }
    if (result.meshesPending) return NOT_YET;
    savePersistedBinMesh(key, result.mesh);
    return yearMesh(result.mesh, params);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Meshes for the given designs: every one in the mesh cache first (the key
 * the designer saves under), then the missing ones from the generator in
 * order, only when the kernel is already on the device. The route turns the
 * background thumbnail pass off, so the shared worker serves this alone.
 */
export function useYearMeshes(
  designs: readonly YearBinRef[],
  nozzleSizeMm: number,
  enabled: boolean
): ReadonlyMap<string, YearMesh> {
  const [meshes, setMeshes] = useState<ReadonlyMap<string, YearMesh>>(() => new Map());

  useEffect(() => {
    if (!enabled || designs.length === 0) return;
    const run = { cancelled: false };
    // A call, so TypeScript does not narrow the flag across the awaits below.
    const stopped = (): boolean => run.cancelled;
    let bridge: Promise<GenerationBridge> | null = null;
    const found = new Map<string, YearMesh>();
    const publish = (id: string, entry: YearMesh | null): void => {
      if (!entry || stopped()) return;
      found.set(id, entry);
      setMeshes(new Map(found));
    };

    void (async () => {
      const kernel = getActiveKernel();
      const missing: { readonly id: string; readonly params: Params; readonly key: string }[] = [];
      for (const design of designs) {
        if (stopped()) return;
        const params = withSocketNozzle(design.params, nozzleSizeMm);
        const key = binMeshCacheKey(params, kernel);
        let entry = session.get(key);
        if (entry === undefined) {
          const cached = await loadPersistedBinMesh(key);
          if (cached) {
            entry = yearMesh(cached, params);
            session.set(key, entry);
          }
        }
        if (entry === undefined) missing.push({ id: design.id, params, key });
        else publish(design.id, entry);
      }

      if (missing.length === 0 || stopped() || !(await isKernelCached(kernel))) return;
      for (const { id, params, key } of missing) {
        if (stopped()) return;
        bridge ??= bridgeManager.acquire();
        let ready: GenerationBridge;
        try {
          ready = await bridge;
        } catch {
          // The engine failed to start; the thumbnails stay.
          return;
        }
        if (stopped()) return;
        const entry = await generateWithin(ready, params, key);
        if (entry === NOT_YET) continue;
        session.set(key, entry);
        publish(id, entry);
      }
    })();

    return () => {
      run.cancelled = true;
      if (bridge)
        void bridge.then(
          () => bridgeManager.release(),
          () => undefined
        );
    };
  }, [designs, nozzleSizeMm, enabled]);

  return meshes;
}

export function __resetYearMeshesForTests(): void {
  session.clear();
}
