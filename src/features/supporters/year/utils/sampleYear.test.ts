import { describe, expect, it } from 'vitest';
import { SAMPLE_SOURCE, sampleMeshesUrl, sampleThumbnail } from '../data/sampleAssets';
import { pickComplicated } from './complicatedPick';
import { buildYearCards } from './yearCards';
import { sampleDrawerPreview, sampleTriangles, sampleYear, type SampleSource } from './sampleYear';

const names = {
  design: (key: string) => `name:${key}`,
  drawer: 'Workbench',
  thumbnail: (id: string) => `thumb:${id}`,
};

describe('sampleYear', () => {
  const { stats } = sampleYear(SAMPLE_SOURCE, names);

  it('shows every card', () => {
    expect(buildYearCards(stats).map((card) => card.kind)).toEqual([
      'intro',
      'drawers',
      'bins',
      'area',
      'biggest',
      'size',
      'designs',
      'month',
      'filament',
      'longest',
      'complicated',
      'exports',
      'type',
      'summary',
      'thanks',
    ]);
  });

  it('earns a real type from its longest print', () => {
    expect(stats.type).toEqual({
      id: 'nightShift',
      values: { name: stats.longestPrint?.name, minutes: stats.longestPrint?.minutes },
    });
    expect(stats.longestPrint?.minutes).toBeGreaterThanOrEqual(8 * 60);
  });

  it('names a busiest month that is the busiest', () => {
    const top = Math.max(...stats.monthCounts);
    expect(stats.busiestMonth).toEqual({ month: stats.monthCounts.indexOf(top), count: top });
  });

  it('lists the other designs by feature score, without the longest print', () => {
    const scores = stats.complexityShortlist.map((entry) => entry.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(stats.complexityShortlist.map((entry) => entry.id)).not.toContain(
      SAMPLE_SOURCE.longestPrint
    );
  });

  it('picks a most complicated bin that is not the longest print', () => {
    const triangles = sampleTriangles(SAMPLE_SOURCE);
    const pick = pickComplicated(stats.complexityShortlist, (id) => triangles.get(id));
    expect(pick?.design.id).not.toBe(SAMPLE_SOURCE.longestPrint);
    expect(pick?.triangles).toBe(
      Math.max(...stats.complexityShortlist.map((entry) => triangles.get(entry.id) ?? 0))
    );
  });

  it('translates names and links thumbnails through the given lookups', () => {
    const longest = SAMPLE_SOURCE.designs.find((d) => d.id === SAMPLE_SOURCE.longestPrint);
    expect(stats.longestPrint).toMatchObject({
      name: `name:${longest?.nameKey}`,
      thumbnail: `thumb:${SAMPLE_SOURCE.longestPrint}`,
    });
    expect(stats.biggestDrawer?.name).toBe('Workbench');
  });

  it('refuses a sample whose longest print is missing', () => {
    const broken: SampleSource = { ...SAMPLE_SOURCE, longestPrint: 'nope' };
    expect(() => sampleYear(broken, names)).toThrow(/nope/);
  });
});

describe('sampleDrawerPreview', () => {
  it('fits every bin inside the drawer with no overlap', () => {
    const preview = sampleDrawerPreview();
    const taken = new Set<string>();
    for (const bin of preview.binMap ?? []) {
      expect(bin.x + bin.w).toBeLessThanOrEqual(preview.drawerWidth);
      expect(bin.y + bin.d).toBeLessThanOrEqual(preview.drawerDepth);
      for (let x = bin.x; x < bin.x + bin.w; x++) {
        for (let y = bin.y; y < bin.y + bin.d; y++) {
          expect(taken.has(`${x},${y}`)).toBe(false);
          taken.add(`${x},${y}`);
        }
      }
    }
    expect(preview.binCount).toBe(preview.binMap?.length);
  });
});

describe('baked sample assets', () => {
  it('has a thumbnail for every design and one mesh file', () => {
    for (const design of SAMPLE_SOURCE.designs) expect(sampleThumbnail(design.id)).toBeTruthy();
    expect(sampleMeshesUrl()).toMatch(/meshes\.glb/);
  });

  it('keeps the longest print the longest', () => {
    const minutes = SAMPLE_SOURCE.designs.map((design) => design.minutes);
    const longest = SAMPLE_SOURCE.designs.find((d) => d.id === SAMPLE_SOURCE.longestPrint);
    expect(longest?.minutes).toBe(Math.max(...minutes));
  });
});
