/**
 * Partial back rails in the gaps label tabs leave (#3401).
 *
 * Asserted on real `railPlacements` rather than a re-derivation of the same
 * arithmetic, so a change to how the builder resolves footprints or coverage
 * shows up here.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { railPlacements } from './lidClickRail';
import { resolveLidInputs } from './lidInputs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

function makeParams(over: Partial<BinParams['label']>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 2,
    height: 6,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, depth: 12, ...over },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      // Pins the NOTCHING path (#3477): `relieveInterior` defaults on for new
      // designs, which steps the interior aside and makes the rails whole, so
      // leaving it on would exercise a different mechanism than this file.
      relieveInterior: false,
    },
  };
}

/** Rails running along X on the BACK wall (rotation 0). */
function backRails(params: BinParams) {
  return railPlacements(resolveLidInputs(params)).filter((p) => p.rotationDeg === 0);
}

describe('back-wall rails around label tabs', () => {
  it('emits none when a full-width tab covers the wall', () => {
    // The historical outcome, now reached by measurement rather than by
    // disabling the wall up front.
    expect(backRails(makeParams({ width: 100 }))).toHaveLength(0);
  });

  it('emits a segment either side of a centred narrow tab', () => {
    const rails = backRails(makeParams({ width: 40, alignment: 'center' }));
    expect(rails).toHaveLength(2);
    // Symmetric about the wall centre, and both worth printing.
    expect(rails[0].centerX).toBeCloseTo(-rails[1].centerX, 3);
    for (const r of rails) expect(r.length).toBeGreaterThan(4);
  });

  it('emits one long segment when the tab is pushed to one end', () => {
    const rails = backRails(makeParams({ width: 40, alignment: 'left' }));
    expect(rails).toHaveLength(1);
    // The tab sits left, so the surviving run is on the right.
    expect(rails[0].centerX).toBeGreaterThan(0);
  });

  it('keeps the front wall untouched by a back tab', () => {
    const front = railPlacements(resolveLidInputs(makeParams({ width: 100 }))).filter(
      (p) => p.rotationDeg === 180
    );
    expect(front).toHaveLength(1);
  });

  it('honours the user turning the back rail off', () => {
    const params = makeParams({ width: 40, alignment: 'center' });
    const off: BinParams = {
      ...params,
      lid: { ...params.lid, clickRails: { ...params.lid.clickRails, back: false } },
    };
    expect(backRails(off)).toHaveLength(0);
  });

  it('shrinks each segment with coverage rather than the whole wall', () => {
    const full = backRails(makeParams({ width: 40, alignment: 'center' }));
    const params = makeParams({ width: 40, alignment: 'center' });
    const half = backRails({ ...params, lid: { ...params.lid, clickRailCoverage: 50 } });
    expect(half).toHaveLength(full.length);
    for (let i = 0; i < full.length; i++) {
      expect(half[i].length).toBeCloseTo(full[i].length / 2, 3);
    }
  });
});
