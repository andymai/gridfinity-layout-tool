// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFractionalEdgeMismatch } from './useFractionalEdgeMismatch';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Bin, Layout } from '@/core/types';

const DESIGN_ID = 'design-1';

function makeLayout(bins: Bin[], drawerEdgeX: 'start' | 'end' = 'start'): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 10, height: 5, fractionalEdgeX: drawerEdgeX },
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 1 }],
    categories: [{ id: 'cat-1', name: 'Category 1', color: '#ff0000' }],
    bins,
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
  };
}

function linkedBin(): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 1.5,
    depth: 2,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    linkedDesignId: DESIGN_ID,
  };
}

function setDesign(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  useDesignerStore.setState({
    currentDesignId: DESIGN_ID,
    params: { ...DEFAULT_BIN_PARAMS, width: 1.5, fractionalEdgeX: 'end', ...overrides },
  });
}

describe('useFractionalEdgeMismatch', () => {
  beforeEach(() => {
    setDesign();
    useLayoutStore.setState({ layout: makeLayout([linkedBin()]) });
  });

  it('flags a mismatch when the linked design disagrees with the drawer', () => {
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(true);
  });

  it('does not flag when the design is not linked to any bin in the layout', () => {
    useLayoutStore.setState({ layout: makeLayout([]) });
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(false);
  });

  it('does not flag when the user chose the edge manually', () => {
    setDesign({ fractionalEdgeManualX: true });
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(false);
  });

  it('matchDrawer aligns the design edge to the drawer and clears the manual flag', () => {
    const { result } = renderHook(() => useFractionalEdgeMismatch());

    act(() => {
      result.current.matchDrawer();
    });

    const params = useDesignerStore.getState().params;
    expect(params.fractionalEdgeX).toBe('start');
    expect(params.fractionalEdgeManualX).toBe(false);
  });
});
