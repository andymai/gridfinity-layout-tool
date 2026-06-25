import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignWarnings } from './useDesignWarnings';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useDesignWarnings', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('is empty for a valid bin with no split/mesh issues', () => {
    const { result } = renderHook(() => useDesignWarnings());
    expect(result.current).toEqual([]);
  });

  it('surfaces a blocker for a mesh generation error', () => {
    const { result } = renderHook(() => useDesignWarnings({ meshError: 'WASM blew up' }));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ id: 'mesh-error', severity: 'blocker' });
  });

  it('rolls up a lid compatibility issue with a jump target to the lid control', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 1, // 1U bin → shortBin lid warning
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      },
    });
    const { result } = renderHook(() => useDesignWarnings());
    const lidWarning = result.current.find((w) => w.id === 'lid:shortBin');
    expect(lidWarning).toBeDefined();
    expect(lidWarning?.severity).toBe('warning');
    expect(lidWarning?.jumpTarget).toEqual({ surface: 'binDesigner:shape', controlId: 'bd-lid' });
  });

  it('ignores lid issues when the lid is disabled', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, height: 1 } });
    const { result } = renderHook(() => useDesignWarnings());
    expect(result.current.every((w) => !w.id.startsWith('lid:'))).toBe(true);
  });

  it('surfaces a split warning when the bin exceeds the bed', () => {
    const { result } = renderHook(() =>
      useDesignWarnings({ needsSplit: true, splitPieceCount: 4 })
    );
    const split = result.current.find((w) => w.id === 'split');
    expect(split).toMatchObject({ id: 'split', severity: 'warning' });
  });
});
