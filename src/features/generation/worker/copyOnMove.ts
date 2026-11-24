import type { KernelCapabilities } from 'brepjs';

/**
 * Make `translate` and `rotate` copy geometry on this OCCT adapter instead of
 * sharing it by location.
 *
 * A shared face also shares its triangulation, and OCCT keeps a finer stored
 * triangulation over a coarser request. Shape caches outlive a generation, so
 * once an export meshes a cached shape, the next preview of a copy keeps the
 * export-density faces, meshes their neighbours at preview density, and the
 * edges between them open.
 *
 * TODO: remove when occt-wasm meshes each request at the requested density.
 */
export function copyOnMove<T extends { readonly capabilities: KernelCapabilities }>(adapter: T): T {
  Object.defineProperty(adapter, 'capabilities', {
    value: { ...adapter.capabilities, placementSharesGeometry: false },
  });
  return adapter;
}
