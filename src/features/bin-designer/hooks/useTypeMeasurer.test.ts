import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTypeMeasurer } from './useTypeMeasurer';
import * as registry from '@/features/bin-designer/utils/typeMeasurer';

describe('useTypeMeasurer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null until every requested face has registered', () => {
    vi.spyOn(registry, 'areTypeFontsLoaded').mockReturnValue(false);
    const { result } = renderHook(() => useTypeMeasurer(['atkinson']));
    expect(result.current).toBeNull();
  });

  it('hands over the shared measurer once the faces are in', () => {
    const measurer = {} as ReturnType<typeof registry.getTypeMeasurer>;
    vi.spyOn(registry, 'areTypeFontsLoaded').mockReturnValue(true);
    vi.spyOn(registry, 'getTypeMeasurer').mockReturnValue(measurer);
    const { result } = renderHook(() => useTypeMeasurer(['atkinson']));
    expect(result.current).toBe(measurer);
  });

  it('asks for the faces it was given', () => {
    const ensure = vi.spyOn(registry, 'ensureTypeFonts').mockImplementation(() => undefined);
    vi.spyOn(registry, 'areTypeFontsLoaded').mockReturnValue(true);
    renderHook(() => useTypeMeasurer(['poppins', 'atkinson']));
    expect(ensure).toHaveBeenCalledWith(expect.arrayContaining(['poppins', 'atkinson']));
  });

  it('does not re-request when only the array identity changes', () => {
    const ensure = vi.spyOn(registry, 'ensureTypeFonts').mockImplementation(() => undefined);
    vi.spyOn(registry, 'areTypeFontsLoaded').mockReturnValue(true);
    // A caller building the list inline hands over a new array every render;
    // the SET of faces is what the effect actually depends on.
    const { rerender } = renderHook(({ f }) => useTypeMeasurer(f), {
      initialProps: { f: ['atkinson'] as const },
    });
    rerender({ f: ['atkinson'] as const });
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when given nothing', () => {
    const ensure = vi.spyOn(registry, 'ensureTypeFonts').mockImplementation(() => undefined);
    vi.spyOn(registry, 'areTypeFontsLoaded').mockReturnValue(true);
    renderHook(() => useTypeMeasurer([]));
    expect(ensure).toHaveBeenCalledWith([]);
  });
});
