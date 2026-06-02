/// <reference types="node" />
/**
 * Shared kernel initialization routines for test infrastructure.
 *
 * Both `wasmInit.ts` (single-kernel mode) and `dualKernelInit.ts` (dual-kernel
 * mode) delegate to these helpers to avoid duplicating WASM loading logic.
 *
 * The triple-slash node reference is intentional: this file uses `fs`/`path`/
 * `process` (Node-only globals) and gets pulled into the app build via the
 * scenario-file import chain.
 */

/** Initialize brepkit-wasm kernel and register it with brepjs. */
export async function initBrepkitKernel(): Promise<void> {
  const { registerKernel, BrepkitAdapter } = await import('brepjs');
  const brepkitWasm = await import('brepkit-wasm');
  // Web target requires explicit WASM init before use; the default export
  // is an init function but brepkit-wasm's types don't declare it.
  const wasmInit = (brepkitWasm as Record<string, unknown>)['default'];
  if (typeof wasmInit === 'function') {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const wasmPath = join(process.cwd(), 'node_modules/brepkit-wasm/brepkit_wasm_bg.wasm');
    const wasmBytes = readFileSync(wasmPath);
    await (wasmInit as (bytes: Uint8Array) => Promise<void>)(wasmBytes);
  }
  const kernel = new brepkitWasm.BrepKernel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  const adapter = new BrepkitAdapter(kernel as any);
  registerKernel('brepkit', adapter);
}

/**
 * Initialize occt-wasm kernel and register it with brepjs under id `'occt-wasm'`.
 * This is the production default geometry kernel.
 */
export async function initOcctWasmKernel(): Promise<void> {
  const { registerKernel, OcctWasmAdapter } = await import('brepjs');
  const { OcctKernel } = await import('occt-wasm');
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmPath = join(process.cwd(), 'node_modules/occt-wasm/dist/occt-wasm.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const kernel = await OcctKernel.init({ wasm: wasmBinary });
  // fromKernel retains the wrapper for the adapter's lifetime, so no manual GC
  // pin is needed. The cast bridges occt-wasm's exported module type, still
  // narrower than brepjs's expected owner (missing VectorString /
  // getExceptionMessage); both exist at runtime — filed upstream.
  registerKernel(
    'occt-wasm',
    OcctWasmAdapter.fromKernel(
      kernel as unknown as Parameters<typeof OcctWasmAdapter.fromKernel>[0]
    )
  );
}
