// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { getBounds, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  SLIDE_FIT_SAMPLE_CLEARANCES,
  buildSlideFitRung,
  buildSlideFitTrayStub,
  buildSlideFitSampleCard,
  exportSlideFitSample,
} from './slideFitSample';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

describe('slide fit sample', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('sweeps a ladder that brackets the shipped default', () => {
    // A ladder that does not contain the default would never confirm it, and a
    // maker whose printer is already right would have no rung to land on.
    expect(SLIDE_FIT_SAMPLE_CLEARANCES).toContain(DEFAULT_BIN_PARAMS.slide.clearanceMm);
    expect(Math.min(...SLIDE_FIT_SAMPLE_CLEARANCES)).toBeLessThan(
      DEFAULT_BIN_PARAMS.slide.clearanceMm
    );
    expect(Math.max(...SLIDE_FIT_SAMPLE_CLEARANCES)).toBeGreaterThan(
      DEFAULT_BIN_PARAMS.slide.clearanceMm
    );
  });

  it('widens the channel monotonically with clearance', () => {
    // THE property that makes the card readable: the tray is constant, so the
    // only thing separating one rung from the next is how much room it leaves.
    const widths = SLIDE_FIT_SAMPLE_CLEARANCES.map((c) =>
      withScope((scope: DisposalScope) => {
        const pieces = buildSlideFitRung(c, DEFAULT_BIN_PARAMS.slide);
        for (const p of pieces) scope.register(p);
        const b = getBounds(scope.register(pieces[0]));
        return b.yMax - b.yMin;
      })
    );
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });

  it('builds a hollow tray stub, not a block', () => {
    const solid = withScope((scope: DisposalScope) => {
      const [stub] = buildSlideFitTrayStub();
      return getBounds(scope.register(stub));
    });
    expect(solid.zMin).toBeCloseTo(0, 3);
    expect(solid.zMax).toBeGreaterThan(0);
  });

  it('lays the tray stub clear of the ladder so they print apart', () => {
    const pieces = buildSlideFitSampleCard();
    try {
      expect(pieces.length).toBeGreaterThan(SLIDE_FIT_SAMPLE_CLEARANCES.length);
    } finally {
      for (const p of pieces) p.delete();
    }
  });

  it('exports one ready-to-slice file', async () => {
    const stl = await exportSlideFitSample('stl');
    expect(stl.fileName).toBe('slide_fit_sample.stl');
    expect(new DataView(stl.data).getUint32(80, true)).toBeGreaterThan(0);
  }, 120_000);
});
