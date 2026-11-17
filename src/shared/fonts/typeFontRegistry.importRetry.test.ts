import { describe, expect, it, vi } from 'vitest';
import { areTypeFontsLoaded, didTypeFontsFail, ensureTypeFonts } from './typeFontRegistry';

const state = vi.hoisted(() => ({ imports: 0 }));

// The first import fails the way a chunk does offline; later ones succeed.
vi.mock('brepjs/text', () => {
  state.imports += 1;
  if (state.imports === 1) throw new Error('Failed to fetch dynamically imported module');
  return {
    loadFont: () => Promise.resolve({ ok: true }),
    getFont: () => ({}),
  };
});

const WAIT = { timeout: 15_000 } as const;

describe('type font registry after a failed module import', () => {
  it('imports the text module again on retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new ArrayBuffer(8))))
    );

    ensureTypeFonts(['atkinson']);
    await vi.waitFor(() => expect(didTypeFontsFail(['atkinson'])).toBe(true), WAIT);

    ensureTypeFonts(['atkinson']);
    await vi.waitFor(() => expect(areTypeFontsLoaded(['atkinson'])).toBe(true), WAIT);
    expect(state.imports).toBe(2);
    vi.unstubAllGlobals();
  });
});
