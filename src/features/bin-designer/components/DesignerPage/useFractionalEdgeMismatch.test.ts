// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFractionalEdgeMismatch } from './useFractionalEdgeMismatch';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Bin, Layout } from '@/core/types';
import { mm, gridUnits, heightUnits, binId, layerId, categoryId, designId } from '@/core/types';

const DESIGN_ID = designId('design-1');

function makeLayout(bins: Bin[], drawerEdgeX: 'start' | 'end' = 'start'): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: {
      width: gridUnits(10),
      depth: gridUnits(10),
      height: heightUnits(5),
      fractionalEdgeX: drawerEdgeX,
    },
    layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(1) }],
    categories: [{ id: categoryId('cat-1'), name: 'Category 1', color: '#ff0000' }],
    bins,
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    printBedSize: mm(256),
  };
}

function linkedBin(): Bin {
  return {
    id: binId('bin-1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1.5),
    depth: gridUnits(2),
    height: heightUnits(3),
    layerId: layerId('layer-1'),
    category: categoryId('cat-1'),
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
