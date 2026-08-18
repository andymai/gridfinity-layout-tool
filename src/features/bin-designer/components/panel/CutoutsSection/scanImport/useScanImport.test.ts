import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanImport } from './useScanImport';
import type { Cutout } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec } from '../svgImport/types';

// Mirrors the store contract: `addCutout` reports whether the cutout landed,
// and the hook's returned count is what it actually stored. The parameter is
// declared so the mock keeps its argument tuple — an implementation typed
// `() => true` narrows `mock.calls` to `[]` and the assertions below stop
// compiling.
const mockAddCutout = vi.fn((_cutout: Cutout) => true);
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();

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
    params: { lid: { cutouts: [] } },
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
    expect(added.path).toEqual(path);
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

  it('commits the transaction even if an addition throws', () => {
    mockAddCutout.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useScanImport());

    expect(() => result.current.addScanCutouts([spec()])).toThrow('boom');
    expect(mockCommitTransaction).toHaveBeenCalledOnce();
  });
});
