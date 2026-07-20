import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm } from '@/core/types';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { useStackPrintStatus } from './useStackPrintStatus';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';

/** A piece whose fingerprint depends only on dims/padding — clone it to repeat. */
function piece(label: string, overrides: Partial<BaseplatePiece> = {}): BaseplatePiece {
  return {
    label,
    col: 0,
    row: 0,
    widthUnits: 2,
    depthUnits: 2,
    gridOffsetX: 0,
    gridOffsetY: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'none',
    fractionalEdgeY: 'none',
    edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
    placementRotationDeg: 0,
    ...overrides,
  };
}

function tiling(
  pieces: BaseplatePiece[],
  margins: BaseplateTiling['margins'] = []
): BaseplateTiling {
  return {
    isSplit: true,
    pieces,
    margins,
    cols: 2,
    rows: 1,
    totalWidthUnits: 4,
    totalDepthUnits: 2,
    stackCount: 1,
    stackSeparatorThickness: 0,
    bedLoads: 1,
    paddingReductionHint: null,
  };
}

describe('useStackPrintStatus', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('reports singlePlate for an unsplit drawer (no tiling) and passes the gap through', () => {
    const { result } = renderHook(() => useStackPrintStatus(0.3));
    expect(result.current.status).toEqual({ kind: 'singlePlate' });
    expect(result.current.gapMm).toBe(0.3);
    expect(result.current.maxPrintHeightMm).toBeGreaterThan(0);
  });

  it('reports ok when a split has two identical pieces to stack', () => {
    // Two pieces with identical dims/padding share a fingerprint → quantity 2.
    useBaseplatePageStore.getState().setTiling(tiling([piece('A1'), piece('A2')]));
    const { result } = renderHook(() => useStackPrintStatus(0.2));
    expect(result.current.status).toEqual({ kind: 'ok' });
  });

  it('reports singlePlate when a split has only unique pieces', () => {
    // Different depths → different fingerprints → each quantity 1, nothing to stack.
    useBaseplatePageStore
      .getState()
      .setTiling(tiling([piece('A1', { depthUnits: 2 }), piece('B1', { depthUnits: 3 })]));
    const { result } = renderHook(() => useStackPrintStatus(0.2));
    expect(result.current.status).toEqual({ kind: 'singlePlate' });
  });

  it('counts detached margin rails so the file readout includes them (#2641)', () => {
    useBaseplatePageStore.getState().setTiling(
      tiling(
        [piece('A1'), piece('A2')],
        [
          {
            id: 'margin-right-1',
            side: 'right',
            role: 'long',
            col: 1,
            row: 0,
            lengthMm: 84,
            bandThicknessMm: 10,
            ownedCorners: [],
            worldOffsetMm: { x: 89, y: 0 },
            overTile: false,
            overTileHalfGrid: false,
            overTileHalfGridSolidLeftover: false,
          },
        ]
      )
    );
    const { result } = renderHook(() => useStackPrintStatus(0.2));
    expect(result.current.railCount).toBe(1);
  });

  it('clears singlePlate and reports the plan when copies ≥ 2 on an unsplit drawer', () => {
    // resetAllStores() doesn't touch the baseplate page store, so clear any
    // tiling a previous test left behind to assert the true unsplit path.
    useBaseplatePageStore.getState().setTiling(null);
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, gapMm: mm(0.2), copies: 3 },
    });
    const { result } = renderHook(() => useStackPrintStatus(0.2));
    expect(result.current.status).toEqual({ kind: 'ok' });
    expect(result.current.plan).toEqual([{ label: 'plate', copies: 3 }]);
  });
});
