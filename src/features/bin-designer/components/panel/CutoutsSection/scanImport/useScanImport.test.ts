import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanImport } from './useScanImport';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { CellMask } from '@/shared/utils/cellMask';
import type { ParsedCutoutSpec } from '../svgImport/types';
import { getCutoutBounds } from '../maskFit';
import { translateCutoutPreview } from '../cutoutHelpers';

// Mirrors the store contract: `addCutout` reports whether the cutout landed,
// and the hook's returned count is what it actually stored. The parameter is
// declared so the mock keeps its argument tuple — an implementation typed
// `() => true` narrows `mock.calls` to `[]` and the assertions below stop
// compiling.
const mockAddCutout = vi.fn((_cutout: Cutout) => true);
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();
const mockQueueDepthPrompt = vi.fn((_ids: readonly string[]) => undefined);
let mockParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 5 };
let mockGrowBin = false;
const mockSetParams = vi.fn((partial: Partial<BinParams>) => {
  mockParams = { ...mockParams, ...partial };
});
const mockUpdateBatch = vi.fn((_updates: ReadonlyMap<string, Partial<Cutout>>) => undefined);

vi.mock('@/features/bin-designer/store', async () => {
  const { remainingCutoutCapacity } = await vi.importActual<{
    remainingCutoutCapacity: (target: unknown, cutouts: unknown) => number;
  }>('@/features/bin-designer/store/slices/cutoutSlice');
  const useDesignerStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addCutout: mockAddCutout,
      setParams: mockSetParams,
      updateCutoutsBatch: mockUpdateBatch,
      startTransaction: mockStartTransaction,
      commitTransaction: mockCommitTransaction,
      queueDepthPrompt: mockQueueDepthPrompt,
    });
  // The capacity gate reads committed state imperatively; a bin-target board
  // has no cap, which is the fixture every case here describes.
  useDesignerStore.getState = () => ({
    ui: { cutoutTarget: 'bin', growBinForScan: mockGrowBin, halfGridMode: false },
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
    mockGrowBin = false;
    mockParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 5 };
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

  it('binds the tools of one scan in a shared arrange-only container', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec(), spec({ x: 20 })]);

    const added = mockAddCutout.mock.calls.map(([c]) => c);
    expect(added.every((c) => c.groupId === null)).toBe(true);
    const chains = added.map((c) => c.parentGroups);
    expect(chains[0]).toHaveLength(1);
    expect(chains[1]).toEqual(chains[0]);
  });

  it('leaves a single scanned tool loose', () => {
    const { result } = renderHook(() => useScanImport());
    result.current.addScanCutouts([spec()]);

    expect(mockAddCutout.mock.calls[0][0].parentGroups).toBeUndefined();
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

  it('asks for the thickness of the outlines it stored, and only those', () => {
    mockAddCutout.mockImplementation(() => mockAddCutout.mock.calls.length <= 1);
    const { result } = renderHook(() => useScanImport());

    result.current.addScanCutouts([spec(), spec({ x: 20 })]);

    const stored = mockAddCutout.mock.calls[0][0].id;
    expect(mockQueueDepthPrompt).toHaveBeenCalledOnce();
    expect(mockQueueDepthPrompt).toHaveBeenCalledWith([stored]);
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

  describe('packing for a phone', () => {
    it('adds each tool on its own, then packs and grows inside the one transaction', () => {
      const added: Cutout[] = [];
      mockAddCutout.mockImplementation((c: Cutout) => {
        added.push(c);
        mockParams = { ...mockParams, cutouts: [...mockParams.cutouts, c] };
        return true;
      });
      const { result } = renderHook(() => useScanImport());
      result.current.addScanCutouts(
        // Too long for the 5-unit bin even turned upright, so it has to grow.
        [spec({ width: 250, depth: 30 }), spec({ width: 40, depth: 20 })],
        undefined,
        { pack: true }
      );

      expect(added.every((c) => c.parentGroups === undefined)).toBe(true);
      expect(mockSetParams).toHaveBeenCalledOnce();
      expect(mockUpdateBatch).toHaveBeenCalledOnce();

      // Every tool placed, and every placement inside the grown bin.
      const batch = mockUpdateBatch.mock.calls[0][0];
      expect([...batch.keys()].sort()).toEqual(added.map((c) => c.id).sort());
      const { innerW, innerD } = cutoutInterior(mockParams);
      expect(mockParams.width).toBeGreaterThan(2);
      for (const c of added) {
        const b = getCutoutBounds(translateCutoutPreview(c, batch.get(c.id) ?? {}));
        expect(b.minX).toBeGreaterThanOrEqual(0);
        expect(b.minY).toBeGreaterThanOrEqual(0);
        expect(b.maxX).toBeLessThanOrEqual(innerW + 1e-6);
        expect(b.maxY).toBeLessThanOrEqual(innerD + 1e-6);
      }

      const open = mockStartTransaction.mock.invocationCallOrder[0];
      const commit = mockCommitTransaction.mock.invocationCallOrder[0];
      expect(open).toBeLessThan(mockAddCutout.mock.invocationCallOrder[0]);
      expect(mockSetParams.mock.invocationCallOrder[0]).toBeLessThan(commit);
      expect(mockUpdateBatch.mock.invocationCallOrder[0]).toBeLessThan(commit);
      mockAddCutout.mockImplementation((_c: Cutout) => true);
    });
  });

  describe('a bin started for the scan', () => {
    it('grows to hold a tool that does not fit, inside the same undo step, then centers it', () => {
      mockGrowBin = true;
      const { result } = renderHook(() => useScanImport());
      result.current.addScanCutouts([spec({ width: 150, depth: 30 })]);

      expect(mockSetParams).toHaveBeenCalledOnce();
      const grown = mockSetParams.mock.calls[0][0];
      expect(grown.width).toBeGreaterThan(2);
      expect(mockStartTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        mockSetParams.mock.invocationCallOrder[0]
      );
      expect(mockSetParams.mock.invocationCallOrder[0]).toBeLessThan(
        mockCommitTransaction.mock.invocationCallOrder[0]
      );
      const placed = mockAddCutout.mock.calls[0][0];
      expect(placed.x).toBeGreaterThan(0);
    });

    it('grows for a trace whose frame starts a hair before the origin', () => {
      mockGrowBin = true;
      const { result } = renderHook(() => useScanImport());
      result.current.addScanCutouts([spec({ width: 150, depth: 30, y: -0.03 })]);
      expect(mockSetParams).toHaveBeenCalledOnce();
    });

    it('grows for a traced path with a vertex before the origin', () => {
      mockGrowBin = true;
      const corner = (x: number, y: number) => ({
        x,
        y,
        handleIn: null,
        handleOut: null,
        symmetric: false,
      });
      const { result } = renderHook(() => useScanImport());
      result.current.addScanCutouts([
        spec({
          shape: 'path',
          width: 150,
          depth: 30,
          path: [corner(0, -0.4), corner(150, 0), corner(150, 30), corner(0, 30)],
        }),
      ]);
      expect(mockSetParams).toHaveBeenCalledOnce();
    });

    it('leaves a bin it was not started for at its size', () => {
      const { result } = renderHook(() => useScanImport());
      result.current.addScanCutouts([spec({ width: 150, depth: 30 })]);
      expect(mockSetParams).not.toHaveBeenCalled();
    });
  });
});
