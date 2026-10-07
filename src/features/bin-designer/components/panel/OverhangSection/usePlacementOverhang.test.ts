import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlacementOverhang } from './usePlacementOverhang';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { binId, designId, gridUnits, mm } from '@/core/types';
import type { Bin, StoredBaseplateParams } from '@/core/types';
import type { CellMask } from '@/shared/utils/cellMask';

const DESIGN = designId('design-1');
const BIN = binId('bin-1');

function setLayout(bins: Bin[], padding: Partial<StoredBaseplateParams> = {}) {
  const base = createDefaultLayout();
  useLayoutStore.setState({
    layout: {
      ...base,
      drawer: { ...base.drawer, width: gridUnits(5), depth: gridUnits(4) },
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: mm(6),
        magnetDepth: mm(2),
        paddingLeft: mm(0),
        paddingRight: mm(0),
        paddingFront: mm(0),
        paddingBack: mm(0),
        ...padding,
      },
      bins,
    },
  });
}

/** Front-left corner bin, linked to the design under edit. */
function cornerBin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ id: BIN, linkedDesignId: DESIGN, extendToMargin: true, ...overrides });
}

function openFromBin(bin: string | null) {
  const url = bin === null ? `/designer?id=${DESIGN}` : `/designer?id=${DESIGN}&bin=${bin}`;
  window.history.replaceState(null, '', url);
}

describe('usePlacementOverhang', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      currentDesignId: DESIGN,
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
    setLayout([cornerBin()], { paddingLeft: mm(4.5), paddingFront: mm(3) });
    openFromBin(BIN);
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('reports the margin overhang of the bin the design was opened from, nonzero sides only', () => {
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toEqual({
      source: 'margin',
      sides: [
        { side: 'left', mm: 4.5 },
        { side: 'front', mm: 3 },
      ],
    });
  });

  it('names Expand to Fit when the bin carries its own overhang', () => {
    setLayout([
      cornerBin({
        extendToMargin: false,
        overhang: { left: 0, right: 6, front: 0, back: 2, enabled: true },
      }),
    ]);
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toEqual({
      source: 'expandToFit',
      sides: [
        { side: 'right', mm: 6 },
        { side: 'back', mm: 2 },
      ],
    });
  });

  it('is null when the URL names no bin', () => {
    openFromBin(null);
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toBeNull();
  });

  it('is null when the bin is no longer in the layout', () => {
    openFromBin('bin-gone');
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toBeNull();
  });

  it('is null when the bin is linked to a different design', () => {
    setLayout([cornerBin({ linkedDesignId: designId('design-2') })], { paddingLeft: mm(4.5) });
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toBeNull();
  });

  it('is null when the bin resolves no overhang', () => {
    setLayout([cornerBin({ extendToMargin: false })], { paddingLeft: mm(4.5) });
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toBeNull();
  });

  it('is null for a custom shape, which prints no overhang at all', () => {
    const mask: CellMask = {
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] as (0 | 1)[],
    };
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, cellMask: mask },
    });
    const { result } = renderHook(() => usePlacementOverhang());
    expect(result.current).toBeNull();
  });

  it('follows a live padding edit in the layout', () => {
    const { result } = renderHook(() => usePlacementOverhang());
    act(() => {
      setLayout([cornerBin()], { paddingLeft: mm(7) });
    });
    expect(result.current?.sides).toEqual([{ side: 'left', mm: 7 }]);
  });

  it('clears once the designer switches to another design', () => {
    const { result } = renderHook(() => usePlacementOverhang());
    act(() => {
      useDesignerStore.setState({ currentDesignId: 'design-2' });
    });
    expect(result.current).toBeNull();
  });
});
