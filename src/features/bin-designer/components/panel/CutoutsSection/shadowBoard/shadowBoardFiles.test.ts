import { describe, it, expect } from 'vitest';
import { shadowBoardDxf, shadowBoardFileName, shadowBoardSvg } from './shadowBoardFiles';
import type { ShadowBoardPlan } from './shadowBoardPlan';

const square = (cx: number, cy: number, h: number) => [
  { x: cx - h, y: cy - h },
  { x: cx + h, y: cy - h },
  { x: cx + h, y: cy + h },
  { x: cx - h, y: cy + h },
];

const PLAN: ShadowBoardPlan = {
  outline: [square(0, 0, 40)],
  openings: [[square(-10, 20, 8), square(-10, 20, 3)], [square(20, -20, 5)]],
};

describe('shadowBoardSvg', () => {
  const svg = shadowBoardSvg(PLAN, false);

  it('is sized in real millimetres around the footprint', () => {
    expect(svg).toContain('width="84mm" height="84mm" viewBox="0 0 84 84"');
  });

  it('flips Y once, so the top of the bin is the top of the page', () => {
    // The opening centred 20 mm above the middle spans 2 + 40 - 28 = 14 to 30 mm
    // down the page, its lower edge (y = 12) the lower one on the page too.
    expect(svg).toMatch(/M 24 30 L 40 30 L 40 14 L 24 14 Z/);
  });

  it('keeps an island inside its opening with an even-odd path', () => {
    const openings = svg.slice(svg.indexOf('id="openings"'));
    expect(openings.match(/<path /g)).toHaveLength(2);
    expect(openings).toContain('fill-rule="evenodd"');
  });

  it('says whether the openings include clearance', () => {
    expect(svg).toContain('without clearance');
    expect(shadowBoardSvg(PLAN, true)).toContain('include each pocket clearance');
  });
});

describe('shadowBoardDxf', () => {
  const dxf = shadowBoardDxf(PLAN, false);

  it('puts the footprint and the openings on their own layers, islands with their shell', () => {
    const layersOf = (type: string) =>
      [...dxf.matchAll(new RegExp(`0\\n${type}\\n8\\n(\\w+)`, 'g'))].map((m) => m[1]);
    expect(layersOf('POLYLINE')).toEqual(['BIN_OUTLINE', 'OPENINGS', 'OPENINGS', 'OPENINGS']);
  });
});

describe('shadowBoardFileName', () => {
  it('names the file after the design', () => {
    expect(shadowBoardFileName('Screwdrivers', 'dxf')).toBe('Screwdrivers-shadow-board.dxf');
    expect(shadowBoardFileName('Untitled Bin', 'svg')).toBe('gridfinity-shadow-board.svg');
  });
});
