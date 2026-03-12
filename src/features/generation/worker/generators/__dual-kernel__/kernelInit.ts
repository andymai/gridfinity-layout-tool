/**
 * Shared kernel initialization routines for test infrastructure.
 *
 * Both `wasmInit.ts` (single-kernel mode) and `dualKernelInit.ts` (dual-kernel
 * mode) delegate to these helpers to avoid duplicating WASM loading logic.
 */

/** Initialize OCCT via brepjs-opencascade WASM binary. */
export async function initOcctKernel(): Promise<void> {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await (opencascade as (opts?: Record<string, unknown>) => Promise<unknown>)({
    wasmBinary,
  });
  initFromOC(OC);
}

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
