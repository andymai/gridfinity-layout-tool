import { describe, it, expect } from 'vitest';
import { resolveLidInputs } from './lidBuilder';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

function makeParams(lid: Partial<LidConfig> = {}, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  };
}

describe('resolveLidInputs', () => {
  it('derives outer dimensions from bin width/depth and grid unit', () => {
    const inputs = resolveLidInputs(makeParams({}, { width: 3, depth: 2 }));
    // 3 grid units × 42mm − 2 × fitClearance (0.2)
    expect(inputs.lidOuterW).toBeCloseTo(125.6, 3);
    expect(inputs.lidOuterD).toBeCloseTo(83.6, 3);
    expect(inputs.cellsX).toBe(3);
    expect(inputs.cellsY).toBe(2);
  });

  it('maps fit enum to clearance values', () => {
    const loose = resolveLidInputs(makeParams({ fit: 'loose' }));
    const standard = resolveLidInputs(makeParams({ fit: 'standard' }));
    const tight = resolveLidInputs(makeParams({ fit: 'tight' }));
    expect(loose.fitClearance).toBeGreaterThan(standard.fitClearance);
    expect(standard.fitClearance).toBeGreaterThan(tight.fitClearance);
    expect(loose.fitClearance).toBeCloseTo(0.3, 4);
    expect(standard.fitClearance).toBeCloseTo(0.2, 4);
    expect(tight.fitClearance).toBeCloseTo(0.1, 4);
  });

  it('passes through wall + top thickness from config', () => {
    const inputs = resolveLidInputs(makeParams({ wallThickness: 1.6, topThickness: 1.2 }));
    expect(inputs.wallThickness).toBe(1.6);
    expect(inputs.topThickness).toBe(1.2);
  });

  it('passes through stackable + magnet toggles', () => {
    const inputs = resolveLidInputs(makeParams({ stackableTop: false, magnetHoles: true }));
    expect(inputs.stackableTop).toBe(false);
    expect(inputs.magnetHoles).toBe(true);
  });

  it('inherits magnet diameter and depth from bin BaseConfig', () => {
    const inputs = resolveLidInputs(
      makeParams(
        { magnetHoles: true },
        { base: { ...DEFAULT_BIN_PARAMS.base, magnetDiameter: 6.0, magnetDepth: 2.5 } }
      )
    );
    expect(inputs.magnetDiameter).toBe(6.0);
    expect(inputs.magnetDepth).toBe(2.5);
  });

  it('omits front/back rails when bin has label tabs (label sits on back wall)', () => {
    const withLabel = resolveLidInputs(
      makeParams({}, { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } })
    );
    expect(withLabel.omitFrontBackRails).toBe(true);
  });

  it('keeps all four rails when bin has no label tabs', () => {
    const noLabel = resolveLidInputs(makeParams({}));
    expect(noLabel.omitFrontBackRails).toBe(false);
  });

  it('anchorZ sits within the lid (above wall bottom, below floor top)', () => {
    const inputs = resolveLidInputs(makeParams({}));
    expect(inputs.anchorZ).toBeLessThan(0);
    expect(inputs.anchorZ).toBeGreaterThan(inputs.wallBottomZ);
  });

  it('converts clickRailCoverage from percent (0–100) to fraction (0–1)', () => {
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 100 })).clickRailCoverage).toBe(1);
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 75 })).clickRailCoverage).toBe(0.75);
    expect(resolveLidInputs(makeParams({ clickRailCoverage: 50 })).clickRailCoverage).toBe(0.5);
  });
});
