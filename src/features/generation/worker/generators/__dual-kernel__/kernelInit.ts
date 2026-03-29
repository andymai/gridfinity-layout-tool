/**
 * Shared kernel initialization routines for test infrastructure.
 *
 * Both `wasmInit.ts` (single-kernel mode) and `dualKernelInit.ts` (dual-kernel
 * mode) delegate to these helpers to avoid duplicating WASM loading logic.
 *
 * All three kernels follow the same pattern: load WASM → create adapter → register.
 */

import type { OcctWasmModule } from 'brepjs';

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

/** Initialize occt-wasm (arena-based OCCT V8) kernel. */
export async function initOcctWasmKernel(): Promise<void> {
  const { registerKernel, OcctWasmAdapter } = await import('brepjs');
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmPath = join(process.cwd(), 'node_modules/occt-wasm/dist/occt-wasm.wasm');
  const wasmBinary = readFileSync(wasmPath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Emscripten module loaded dynamically
  const createModule = (await import('occt-wasm/dist/occt-wasm.js')).default;
  const Module = await (createModule as (opts?: Record<string, unknown>) => Promise<unknown>)({
    wasmBinary,
  });
  const mod = Module as OcctWasmModule;
  const kernel = new mod.OcctKernel();
  registerKernel('occt-wasm', new OcctWasmAdapter(mod, kernel));
}

/** Initialize brepkit-wasm (Rust-native) kernel. */
export async function initBrepkitKernel(): Promise<void> {
  const { registerKernel, BrepkitAdapter } = await import('brepjs');
  const brepkitWasm = await import('brepkit-wasm');
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
  registerKernel('brepkit', new BrepkitAdapter(kernel as any));
}
