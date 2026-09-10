/**
 * Small-grid-pitch generation scenarios.
 *
 * The designer accepts a grid pitch anywhere in 1-200mm
 * (`DESIGNER_GRID_UNIT_MM_MIN`/`_MAX`), and every tapered section along the
 * socket, box and lid profiles derives its size and its corner radius from the
 * same inset. Flooring those independently let the radius outgrow the rectangle
 * it was rounding, which brepjs answers with a hard
 * `Bug in Sketcher2d.tangentArc` rather than a clamp: bins threw below a 6.5mm
 * pitch and stack-grid lids below 6mm (#4218).
 *
 *   pnpm run test:run src/features/generation/worker/generators/smallGridPitch.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { generateBin } from './binGenerator';
import { generateLid } from './lidOrchestrator';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Spans the designer's range, clustered where the profile insets bite. */
const PITCHES = [1, 2, 3, 4, 6, 6.5, 7, 12, 42] as const;

function params(pitch: number, stackableTop: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 3,
    height: 3,
    gridUnitMm: pitch,
    gridUnitMmY: pitch,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'friction',
      stackableTop,
    },
  };
}

describe('small grid pitch', () => {
  it.each(PITCHES)('builds a bin at a %smm pitch', (pitch) => {
    assertStructurallyValid(generateBin(params(pitch, false), undefined, true), `bin @ ${pitch}mm`);
  });

  it.each(PITCHES)('builds a lid at a %smm pitch', (pitch) => {
    const lid = generateLid(params(pitch, false), undefined, true);
    expect(lid, `lid @ ${pitch}mm`).not.toBeNull();
    if (lid) assertStructurallyValid(lid, `lid @ ${pitch}mm`);
  });

  it.each(PITCHES)('builds a stack-grid lid at a %smm pitch', (pitch) => {
    const lid = generateLid(params(pitch, true), undefined, true);
    expect(lid, `stack lid @ ${pitch}mm`).not.toBeNull();
    if (lid) assertStructurallyValid(lid, `stack lid @ ${pitch}mm`);
  });

  it('builds a non-square pitch whose axes straddle the old threshold', () => {
    const p = { ...params(42, true), gridUnitMm: 4, gridUnitMmY: 20 };
    assertStructurallyValid(generateBin(p, undefined, true), 'bin @ 4x20mm');
    const lid = generateLid(p, undefined, true);
    expect(lid).not.toBeNull();
    if (lid) assertStructurallyValid(lid, 'stack lid @ 4x20mm');
  });
});
