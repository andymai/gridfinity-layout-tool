import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams, LidSlideConfig } from '@/features/bin-designer/types';
import { slideLidPlanForParams } from '@/shared/types/bin';
import type { LidCompatibilitySide } from '@/shared/types/bin';
import type { LipGap } from './lipGapPlan';
import type { SlideLidGeometry } from './slideLidPlan';
import { liningBandDepthMm, withLiningOpenings } from './slideLidLiningOpenings';

function geometryAt(wallThickness: number, slide: Partial<LidSlideConfig> = {}): SlideLidGeometry {
  const params: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    wallThickness,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'slide',
      slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide },
    },
  };
  const { geometry } = slideLidPlanForParams(params);
  if (!geometry) throw new Error('expected slide geometry');
  return geometry;
}

function gap(side: LidCompatibilitySide, lo: number, hi: number): LipGap {
  return { side, source: 'cutout', lo, hi, wallSpan: 80 };
}

function openingsFor(entrySide: LidSlideConfig['entrySide'], gaps: readonly LipGap[]) {
  const geometry = geometryAt(0.8, { entrySide });
  const lining = geometry.wallLining;
  if (!lining) throw new Error('expected a lining');
  return { lining, openings: withLiningOpenings(geometry, gaps).wallLining?.openings ?? [] };
}

describe('withLiningOpenings', () => {
  it('cuts the far wall’s lining across the gap, through its whole thickness', () => {
    const { lining, openings } = openingsFor('front', [gap('back', -10, 20)]);
    const outer = -lining.bodyLengthMm / 2;
    expect(openings).toHaveLength(1);
    const [o] = openings;
    expect(o.yMin).toBeCloseTo(-10, 9);
    expect(o.yMax).toBeCloseTo(20, 9);
    expect(o.xMin).toBeLessThan(outer);
    expect(o.xMax).toBeGreaterThan(outer + lining.channelInsetMm);
    expect(o.xMax).toBeLessThan(0);
  });

  it('cuts the entry wall’s lining on the entry side', () => {
    const { lining, openings } = openingsFor('front', [gap('front', -10, 20)]);
    expect(openings).toHaveLength(1);
    expect(openings[0].xMin).toBeLessThan(lining.bodyLengthMm / 2 - lining.channelInsetMm);
    expect(openings[0].xMax).toBeGreaterThan(lining.bodyLengthMm / 2);
  });

  it('leaves the channel walls to the bar and its warning', () => {
    const geometry = geometryAt(0.8, { entrySide: 'front' });
    expect(withLiningOpenings(geometry, [gap('left', -5, 5), gap('right', -5, 5)])).toBe(geometry);
  });

  it.each([
    // [entry, gap side, canonical end (+1 entry, -1 far), canonical y range]
    ['front', 'back', -1, [-10, 20]],
    ['back', 'back', 1, [-20, 10]],
    ['back', 'front', -1, [-20, 10]],
    ['right', 'left', -1, [-10, 20]],
    ['left', 'left', 1, [-20, 10]],
    ['left', 'right', -1, [-20, 10]],
  ] as const)(
    'maps a %s-entry lid’s %s gap onto the canonical frame',
    (entry, side, end, [y0, y1]) => {
      const { openings } = openingsFor(entry, [gap(side, -10, 20)]);
      expect(openings).toHaveLength(1);
      const [o] = openings;
      expect(Math.sign(o.xMin + o.xMax)).toBe(end);
      expect(o.yMin).toBeCloseTo(y0, 9);
      expect(o.yMax).toBeCloseTo(y1, 9);
    }
  );

  it('changes nothing on a wall thick enough to carry the channel itself', () => {
    const geometry = geometryAt(1.2);
    expect(geometry.wallLining).toBeNull();
    expect(withLiningOpenings(geometry, [gap('back', -10, 20)])).toBe(geometry);
  });
});

describe('liningBandDepthMm', () => {
  it('reaches below the plate’s top by the lining’s depth and its chamfer', () => {
    const geometry = geometryAt(0.4);
    const lining = geometry.wallLining;
    if (!lining) throw new Error('expected a lining');
    const chamferRun = lining.channelInsetMm - lining.cavityInsetMm;
    expect(liningBandDepthMm(geometry, lining)).toBeGreaterThan(
      geometry.plateTopBelowWallTopMm - lining.zMin + chamferRun
    );
  });
});
