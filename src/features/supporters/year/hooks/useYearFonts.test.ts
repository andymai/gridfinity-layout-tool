import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useYearFonts } from './useYearFonts';

describe('useYearFonts', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts at once where fonts cannot load, on the fallbacks', () => {
    const { result } = renderHook(() => useYearFonts('Your year'));
    expect(result.current.ready).toBe(true);
    expect(
      result.current.measure('ab', { family: 'x', weight: 400, size: 10, lineHeight: 10 })
    ).toBe(10);
  });

  it('waits for the text before it is ready', () => {
    const { result } = renderHook(() => useYearFonts(null));
    expect(result.current.ready).toBe(false);
  });

  it('loads the faces the text needs, then is ready', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const add = vi.fn();
    vi.stubGlobal('FontFace', vi.fn());
    Object.defineProperty(document, 'fonts', { value: { load, add }, configurable: true });
    const { result } = renderHook(() => useYearFonts('Schubladenfläche'));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(load).toHaveBeenCalledWith(
      expect.stringContaining('Y26 Display'),
      expect.stringContaining('Schubladenfläche')
    );
    Reflect.deleteProperty(document, 'fonts');
  });
});
