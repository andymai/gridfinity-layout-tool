import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/shared/types/bin';
import { withSocketNozzle } from './socketNozzle';

const textBin: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'text' },
};

const socketBin: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' },
};

describe('withSocketNozzle', () => {
  it('leaves a non-socket bin untouched at any nozzle (same reference)', () => {
    expect(withSocketNozzle(textBin, 0.8)).toBe(textBin);
    expect(withSocketNozzle(textBin, 0.4)).toBe(textBin);
  });

  it('leaves a socket bin untouched at or below the 0.4mm baseline', () => {
    // Same reference so the mesh cache key stays byte-identical to pre-#2690.
    expect(withSocketNozzle(socketBin, 0.4)).toBe(socketBin);
    expect(withSocketNozzle(socketBin, 0.3)).toBe(socketBin);
  });

  it('injects the nozzle for a socket bin above baseline', () => {
    const merged = withSocketNozzle(socketBin, 0.6);
    expect(merged).not.toBe(socketBin);
    expect(merged.nozzleSizeMm).toBe(0.6);
    // Never mutates the input — persistence keeps writing nozzle-free params.
    expect(socketBin.nozzleSizeMm).toBeUndefined();
  });

  it('is idempotent when the nozzle is already set', () => {
    const merged = withSocketNozzle(socketBin, 0.6);
    expect(withSocketNozzle(merged, 0.6)).toBe(merged);
  });

  it('ignores a non-finite nozzle', () => {
    expect(withSocketNozzle(socketBin, Number.NaN)).toBe(socketBin);
    expect(withSocketNozzle(socketBin, Number.POSITIVE_INFINITY)).toBe(socketBin);
  });
});
