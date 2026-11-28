import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useYearFonts } from './useYearFonts';

describe('useYearFonts', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('starts on the time limit, then measures again once slow faces arrive', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A canvas that measures, so each new measure is a new function.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: () => ({ width: 1 }),
    } as unknown as CanvasRenderingContext2D);
    let release: () => void = () => undefined;
    const load = vi.fn().mockReturnValue(new Promise((resolve) => (release = () => resolve([]))));
    vi.stubGlobal('FontFace', vi.fn());
    Object.defineProperty(document, 'fonts', { value: { load, add: vi.fn() }, configurable: true });
    const { result } = renderHook(() => useYearFonts('Your year'));
    expect(result.current.ready).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.ready).toBe(true);
    const early = result.current.measure;
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(result.current.measure).not.toBe(early);
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('stays ready when the text changes after the first load', async () => {
    let release: () => void = () => undefined;
    const load = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('FontFace', vi.fn());
    Object.defineProperty(document, 'fonts', { value: { load, add: vi.fn() }, configurable: true });
    const { result, rerender } = renderHook(({ text }) => useYearFonts(text), {
      initialProps: { text: '1 triangle' },
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    load.mockReturnValue(new Promise((resolve) => (release = () => resolve([]))));
    rerender({ text: '8,010 triangles' });
    expect(result.current.ready).toBe(true);
    release();
    Reflect.deleteProperty(document, 'fonts');
  });
});
