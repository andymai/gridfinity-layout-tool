import { useEffect, useState } from 'react';
import { bridgeManager, getActiveKernel, type GenerationBridge } from '@/shared/generation/bridge';
import {
  binMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
} from '@/shared/generation/meshPersistence';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import type { MeshData } from '@/shared/types/generation';
import type { YearBinRef } from '../types';
import { isKernelCached } from '../utils/kernelCache';
import { meshTriangles } from '../utils/meshTriangles';

export interface YearMesh {
  readonly mesh: MeshData;
  readonly triangles: number;
}

/**
 * The bridge's own timeout never drops below 30 s, and a cancel cannot stop a
 * WASM call in progress, so a slow design is cut off by resetting the worker.
 */
const GENERATION_LIMIT_MS = 20_000;

/** Per session, so a replay or a return from the credits generates nothing twice. */
const session = new Map<string, YearMesh | null>();

async function generateWithin(
  bridge: GenerationBridge,
  params: YearBinRef['params'],
  key: string
): Promise<YearMesh | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), GENERATION_LIMIT_MS);
  });
  try {
    const result = await Promise.race([bridge.generateImmediate(params), limit]);
    if (result === 'timeout') {
      bridge.hardResetWorker('Your 2026 cut off a slow design');
      return null;
    }
    if (!result.meshesPending) savePersistedBinMesh(key, result.mesh);
    return { mesh: result.mesh, triangles: meshTriangles(result.mesh) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Meshes for the given designs, in order: the mesh cache first (the key the
 * designer saves under), then the generator, only when the kernel is already
 * on the device. The route turns the background thumbnail pass off, so the
 * shared worker serves this alone.
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

    void (async () => {
      const kernel = getActiveKernel();
      let canGenerate: boolean | null = null;
      for (const design of designs) {
        if (stopped()) return;
        const params = withSocketNozzle(design.params, nozzleSizeMm);
        const key = binMeshCacheKey(params, kernel);
        let entry = session.get(key);
        if (entry === undefined) {
          const cached = await loadPersistedBinMesh(key);
          if (cached) {
            entry = { mesh: cached, triangles: meshTriangles(cached) };
          } else {
            canGenerate ??= await isKernelCached();
            if (!canGenerate || stopped()) continue;
            bridge ??= bridgeManager.acquire();
            entry = await generateWithin(await bridge, params, key);
          }
          session.set(key, entry);
        }
        if (entry && !stopped()) {
          found.set(design.id, entry);
          setMeshes(new Map(found));
        }
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
