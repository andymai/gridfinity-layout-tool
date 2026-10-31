import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanImport } from './useScanImport';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { CellMask } from '@/shared/utils/cellMask';
import type { ParsedCutoutSpec } from '../svgImport/types';

// Mirrors the store contract: `addCutout` reports whether the cutout landed,
// and the hook's returned count is what it actually stored. The parameter is
// declared so the mock keeps its argument tuple — an implementation typed
// `() => true` narrows `mock.calls` to `[]` and the assertions below stop
// compiling.
const mockAddCutout = vi.fn((_cutout: Cutout) => true);
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();
let mockParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 5 };

vi.mock('@/features/bin-designer/store', async () => {
  const { remainingCutoutCapacity } = await vi.importActual<{
    remainingCutoutCapacity: (target: unknown, cutouts: unknown) => number;
  }>('@/features/bin-designer/store/slices/cutoutSlice');
  const useDesignerStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addCutout: mockAddCutout,
      startTransaction: mockStartTransaction,
      commitTransaction: mockCommitTransaction,
    });
  // The capacity gate reads committed state imperatively; a bin-target board
  // has no cap, which is the fixture every case here describes.
  useDesignerStore.getState = () => ({
    ui: { cutoutTarget: 'bin' },
    params: mockParams,
  });
  return { useDesignerStore, remainingCutoutCapacity };
});

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

function spec(partial: Partial<ParsedCutoutSpec> = {}): ParsedCutoutSpec {
  return {
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cornerRadius: 0,
    rotation: 0,
    ...partial,
  };
}

describe('useScanImport', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockAddCutout.mockReturnValue(true);
    mockParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 5 };
  });

  it('adds each spec as a cutout and returns the count', () => {
    const { result } = renderHook(() => useScanImport());
    const count = result.current.addScanCutouts([spec(), spec({ x: 20 })]);

    expect(count).toBe(2);
    expect(mockAddCutout).toHaveBeenCalledTimes(2);
  });

  it('counts what was stored, not what was asked for', () => {
    // A refused write (the target is at its cap) must not be reported as added:
    // the caller toasts this number.
    mockAddCutout.mockImplementation(() => mockAddCutout.mock.calls.length <= 1);
    const { result } = renderHook(() => useScanImport());

    const count = result.current.addScanCutouts([spec(), spec({ x: 20 }), spec({ x: 40 })]);

    expect(mockAddCutout).toHaveBeenCalledTimes(3);
    expect(count).toBe(1);
  });

  it('wraps all additions in a single undo transaction', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec(), spec()]);

    expect(mockStartTransaction).toHaveBeenCalledOnce();
    expect(mockCommitTransaction).toHaveBeenCalledOnce();
  });

  it('hydrates specs with a generated id and the given cut depth', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec()], 8);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.cutDepth).toBe(8);
    expect(typeof added.id).toBe('string');
    expect(added.id.length).toBeGreaterThan(0);
  });

  it('preserves a path spec when hydrating', () => {
    const { result } = renderHook(() => useScanImport());
    const path = [
      { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
      { x: 10, y: 0, handleIn: null, handleOut: null, symmetric: false },
      { x: 5, y: 8, handleIn: null, handleOut: null, symmetric: false },
    ];
    result.current.addScanCutouts([spec({ shape: 'path', path })]);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.shape).toBe('path');
    expect(added.path?.map((p) => [p.x - added.x, p.y - added.y])).toEqual(
      path.map((p) => [p.x, p.y])
    );
    // Scanned path outlines get a default fit clearance + self-centering chamfer.
    expect(added.clearance).toBeGreaterThan(0);
    expect(added.chamferWidth).toBeGreaterThan(0);
  });

  it('does not force default fit on non-path scan specs', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec({ shape: 'rectangle' })]);
    expect(mockAddCutout.mock.calls[0][0].clearance).toBeUndefined();
    expect(mockAddCutout.mock.calls[0][0].chamferWidth).toBeUndefined();
  });

  // The scanner's coordinates are the outline's own frame, corner at the origin
  // and a rounding hair past it, so an uncentered scan lands flush in the
  // corner and reads as clipped in a bin with room to spare.
  it('centers a scanned outline in the bin', () => {
    const { innerW, innerD } = cutoutInterior(mockParams);
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec({ y: -0.03, width: 72, depth: 158 })]);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.x).toBeCloseTo((innerW - 72) / 2);
    expect(added.y).toBeCloseTo((innerD - 158) / 2);
  });

  it('moves the outlines of one scan together', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([
      spec({ width: 60, depth: 100 }),
      spec({ x: 20, y: 30, width: 10, depth: 10 }),
    ]);

    const [outer, inner] = mockAddCutout.mock.calls.map(([c]) => c);
    expect(inner.x - outer.x).toBeCloseTo(20);
    expect(inner.y - outer.y).toBeCloseTo(30);
  });

  it('leaves a scan larger than the bin where it landed', () => {
    mockParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 };
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec({ y: -0.03, width: 72, depth: 158 })]);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.x).toBe(0);
    expect(added.y).toBe(-0.03);
  });

  // A 3x2 bin as six by four half cells, 1 = floor.
  function shaped(cells: CellMask['cells']): BinParams {
    return { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, cellMask: { cols: 6, rows: 4, cells } };
  }

  it('keeps a scan in place when the middle of a custom shape is a notch', () => {
    // U-shape: the two middle columns of the top half are open.
    mockParams = shaped([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1]);
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec({ width: 40, depth: 60 })]);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.x).toBe(0);
    expect(added.y).toBe(0);
  });

  it('centers a scan on a custom shape whose middle is floor', () => {
    // Only the bottom-left half cell is open, which is where the scan arrives.
    mockParams = shaped([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const { innerW, innerD } = cutoutInterior(mockParams);
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec({ width: 10, depth: 10 })]);

    const added = mockAddCutout.mock.calls[0][0];
    expect(added.x).toBeCloseTo((innerW - 10) / 2);
    expect(added.y).toBeCloseTo((innerD - 10) / 2);
  });

  it('commits the transaction even if an addition throws', () => {
    mockAddCutout.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useScanImport());

    expect(() => result.current.addScanCutouts([spec()])).toThrow('boom');
    expect(mockCommitTransaction).toHaveBeenCalledOnce();
  });
});
