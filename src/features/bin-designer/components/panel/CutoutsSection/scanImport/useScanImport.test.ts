import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanImport } from './useScanImport';
import type { ParsedCutoutSpec } from '../svgImport/types';

const mockAddCutout = vi.fn();
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addCutout: mockAddCutout,
      startTransaction: mockStartTransaction,
      commitTransaction: mockCommitTransaction,
    }),
}));

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
  afterEach(() => vi.clearAllMocks());

  it('adds each spec as a cutout and returns the count', () => {
    const { result } = renderHook(() => useScanImport());
    const count = result.current.addScanCutouts([spec(), spec({ x: 20 })]);

    expect(count).toBe(2);
    expect(mockAddCutout).toHaveBeenCalledTimes(2);
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
