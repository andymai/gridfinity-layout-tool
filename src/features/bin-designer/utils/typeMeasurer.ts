/**
 * Main-thread font registry and measurer for the designer's type previews.
 *
 * The ghost overlay and the panel specimen have to answer the same questions
 * the worker answers (how big does this caption render, where does its ink
 * land) without a kernel. `brepjs/text` registers a face from a buffer and
 * exposes it as an opentype `Font`, which satisfies {@link GlyphFont}, so both
 * sides feed the SAME `createTypeMeasurer` and the same `planTypeBlock`.
 *
 * Loading is lazy and fire-and-forget: faces arrive over the network, and a
 * preview that is briefly absent is a far better failure than one drawn from
 * guessed metrics. Callers subscribe and re-render when a face lands.
 */

import type { TextFontFamily } from '@/shared/types/bin';
import { TEXT_FONT_URLS } from '@/shared/fonts/fontAssets';
import { createTypeMeasurer, type GlyphFont, type TypeMeasurer } from '@/shared/utils/typePlan';

// Typed off the module's own shape rather than an `import()` annotation, which
// the lint config forbids: only the three entry points this module touches
// matter, and stating them keeps the dynamic import honest.
interface BrepText {
  loadFont: (buffer: ArrayBuffer, family: string) => Promise<{ ok: boolean }>;
  getFont: (family: string) => unknown;
}

let modulePromise: Promise<BrepText> | null = null;
let measurer: TypeMeasurer | null = null;
const loaded = new Set<TextFontFamily>();
const loads = new Map<TextFontFamily, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function textModule(): Promise<BrepText> {
  modulePromise ??= import('brepjs/text');
  return modulePromise;
}

async function loadFamily(family: TextFontFamily): Promise<void> {
  try {
    const mod = await textModule();
    const response = await fetch(TEXT_FONT_URLS[family]);
    if (!response.ok) return;
    const result = await mod.loadFont(await response.arrayBuffer(), family);
    if (!result.ok) return;
    // The registry is global to the module, so the measurer is created once and
    // simply sees more faces as they arrive.
    measurer ??= createTypeMeasurer((f) => mod.getFont(f) as GlyphFont | undefined);
    loaded.add(family);
    notify();
  } catch {
    // A preview is optional. Leaving the family unloaded makes callers fall
    // back to drawing nothing, which is honest; guessing metrics is not.
  }
}

/** Start loading any of `families` not already registered. Safe to call every render. */
export function ensureTypeFonts(families: Iterable<TextFontFamily>): void {
  for (const family of families) {
    if (loaded.has(family) || loads.has(family)) continue;
    loads.set(family, loadFamily(family));
  }
}

export function subscribeTypeFonts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function typeFontsVersion(): number {
  return version;
}

/** The shared measurer, or `null` before any face has registered. */
export function getTypeMeasurer(): TypeMeasurer | null {
  return measurer;
}

export function areTypeFontsLoaded(families: Iterable<TextFontFamily>): boolean {
  for (const family of families) if (!loaded.has(family)) return false;
  return true;
}

/** Test seam: drop every registration so a suite can start from nothing. */
export function resetTypeFontsForTest(): void {
  loaded.clear();
  loads.clear();
  measurer = null;
  modulePromise = null;
  notify();
}
