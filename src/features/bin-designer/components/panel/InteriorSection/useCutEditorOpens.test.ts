import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useCutEditorOpens } from './useCutEditorOpens';

const view = vi.hoisted(() => ({ isDesktop: true }));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: view.isDesktop }),
}));

describe('useCutEditorOpens', () => {
  const initial = useDesignerStore.getState().params;
  afterEach(() => {
    useDesignerStore.setState({ params: initial });
    view.isDesktop = true;
  });

  it('opens on desktop while the bin allows cutouts', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
    expect(renderHook(() => useCutEditorOpens()).result.current).toBe(true);
  });

  it('stays shut off desktop', () => {
    view.isDesktop = false;
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
    expect(renderHook(() => useCutEditorOpens()).result.current).toBe(false);
  });

  it('stays shut while a rule withholds cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'interior' },
      },
    });
    expect(renderHook(() => useCutEditorOpens()).result.current).toBe(false);
  });
});
