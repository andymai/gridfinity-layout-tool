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

/**
 * A 10.5-wide drawer with its half column on the left, so cell boundaries land
 * on `n + 0.5` and a bin at x=0 opens with its half cell ('start'). The drawer
 * width has to be fractional for its edge setting to mean anything — an
 * integer-width drawer has no half column at all (#3070).
 */
function makeLayout(
  bins: Bin[],
  drawerEdgeX: 'start' | 'end' = 'start',
  drawerWidth = 10.5
): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: {
      width: gridUnits(drawerWidth),
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

function linkedBin(x = 0, id = 'bin-1'): Bin {
  return {
    id: binId(id),
    x: gridUnits(x),
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

  it('flags a mismatch when the linked design disagrees with its placement', () => {
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(true);
  });

  it('does not flag a correct foot in a whole-number drawer (#3070)', () => {
    // No half column exists on X, so the drawer's edge setting is meaningless
    // and a bin at x=0 correctly carries its half cell at the end. Comparing
    // against the drawer edge flagged this, then reversed it.
    useLayoutStore.setState({ layout: makeLayout([linkedBin()], 'start', 10) });
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(false);
  });

  it('still flags a genuinely reversed foot in a whole-number drawer', () => {
    setDesign({ fractionalEdgeX: 'start' });
    useLayoutStore.setState({ layout: makeLayout([linkedBin()], 'start', 10) });
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(true);
  });

  it('stays quiet when two placements of the design want opposite edges', () => {
    // One design, two spots. The half cell lands on opposite sides, so no
    // single edge can satisfy both — the conflict is inherent to sharing one
    // design, and a one-click fix would only move it to the sibling.
    useLayoutStore.setState({
      layout: makeLayout([linkedBin(0), linkedBin(0.5, 'bin-2')], 'start', 10),
    });
    const { result } = renderHook(() => useFractionalEdgeMismatch());
    expect(result.current.show).toBe(false);
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

  it('matchDrawer aligns the design edge to the placement and clears the manual flag', () => {
    const { result } = renderHook(() => useFractionalEdgeMismatch());

    act(() => {
      result.current.matchDrawer();
    });

    const params = useDesignerStore.getState().params;
    expect(params.fractionalEdgeX).toBe('start');
    expect(params.fractionalEdgeManualX).toBe(false);
  });
});
