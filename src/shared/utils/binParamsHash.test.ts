import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { hashBinParams } from './binParamsHash';

function params(value: Record<string, unknown>): BinParams {
  return value as unknown as BinParams;
}

describe('hashBinParams', () => {
  it('is stable across key order', () => {
    const a = params({ width: 2, depth: 3, base: { style: 'flat', magnets: false } });
    const b = params({ base: { magnets: false, style: 'flat' }, depth: 3, width: 2 });
    expect(hashBinParams(a)).toBe(hashBinParams(b));
  });

  it('ignores undefined members, matching JSON round trips', () => {
    const local = params({ width: 2, gridUnitMmY: undefined });
    const roundTripped = params(
      JSON.parse(JSON.stringify({ width: 2 })) as Record<string, unknown>
    );
    expect(hashBinParams(local)).toBe(hashBinParams(roundTripped));
  });

  it('changes when a nested value changes', () => {
    const a = params({ width: 2, base: { style: 'flat' } });
    const b = params({ width: 2, base: { style: 'standard' } });
    expect(hashBinParams(a)).not.toBe(hashBinParams(b));
  });

  it('distinguishes arrays from objects with numeric keys', () => {
    const a = params({ cells: [0, 1] });
    const b = params({ cells: { 0: 0, 1: 1 } });
    expect(hashBinParams(a)).not.toBe(hashBinParams(b));
  });

  it('produces an 8-char hex digest', () => {
    expect(hashBinParams(params({ width: 1 }))).toMatch(/^[0-9a-f]{8}$/);
  });
});
