import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
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

function tiling(pieces: BaseplatePiece[]): BaseplateTiling {
  return {
    isSplit: true,
    pieces,
    cols: 2,
    rows: 1,
    totalWidthUnits: 4,
    totalDepthUnits: 2,
    stackCount: 1,
    stackSeparatorThickness: 0,
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
});
