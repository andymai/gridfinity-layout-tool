import { describe, expect, it } from 'vitest';
import type { YearStats } from '../types';
import type { YearCardKind } from '../utils/yearCards';
import { buildScene } from './buildScene';
import { chestLayout, MAX_DRAWERS, rowContact } from './drawersScene';
import { MAX_PLATE, plateGrid } from './exportsScene';
import { MAX_SPOOLS, spoolSpots } from './filamentScene';
import { MAX_STACK, monthStacks } from './monthScene';
import { packShelves } from './designsScene';
import { MAX_SUPPORTER_BINS, supporterSpots } from './thanksScene';
import { CONTENT_TOP, TEXT_FLOOR, blockBottom, type Scene } from './scene';
import { drawerPreview, roughMeasure, sampleStats, sceneInput } from './sceneFixtures.testUtils';

const KINDS: YearCardKind[] = [
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
];

const NAME_40 = 'Workbench left drawer under the bandsaw!';

function need<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('fixture is missing a value');
  return value;
}

/** A year at the far ends of every range, with 40-character names. */
const extreme: YearStats = {
  ...sampleStats,
  drawers: 40,
  binsPlaced: 12_000,
  biggestDrawer: { layoutId: 'l1', name: NAME_40, widthMm: 2100, depthMm: 2100 },
  favouriteSize: { width: 1.5, depth: 0.5, count: 12_000 },
  designs: 500,
  monthCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 400, 0, 1],
  busiestMonth: { month: 9, count: 400 },
  filament: { grams: 250_000, printMinutes: 600_000 },
  longestPrint: { ...need(sampleStats.longestPrint), name: NAME_40 },
  complexityShortlist: [{ ...need(sampleStats.complexityShortlist[0]), name: NAME_40 }],
  exports: 5000,
  type: { id: 'measureTwice', values: { name: NAME_40, count: 300 } },
};

function expectFits(scene: Scene | null): void {
  expect(scene).not.toBeNull();
  if (!scene) return;
  for (const block of scene.texts) {
    if (block.key === 'footer') continue;
    expect(block.y).toBeGreaterThanOrEqual(CONTENT_TOP - 1);
    expect(blockBottom(block)).toBeLessThanOrEqual(TEXT_FLOOR + 0.5);
    expect(Number.isFinite(block.font.size)).toBe(true);
  }
  if (scene.model) expect(scene.model.y + scene.model.h).toBeLessThanOrEqual(TEXT_FLOOR);
  expect(Number.isFinite(scene.still)).toBe(true);
}

describe('buildScene', () => {
  it.each(KINDS)('lays out the sample %s card above the footer', (kind) => {
    expectFits(buildScene(sceneInput(kind)));
  });

  it.each(KINDS)('keeps the %s card above the footer at the far ends of the data', (kind) => {
    const huge = drawerPreview(
      50,
      50,
      Array.from({ length: 2500 }, (_, i): [number, number, number, number, string] => [
        i % 50,
        Math.floor(i / 50),
        1,
        1,
        `#${(i % 7) + 1}00`,
      ])
    );
    expectFits(
      buildScene(sceneInput(kind, { stats: extreme, drawerPreview: huge, supporterCount: 4000 }))
    );
  });

  it('keeps long German copy above the footer on every card', () => {
    for (const kind of KINDS) {
      const scene = buildScene(
        sceneInput(kind, {
          locale: 'de',
          t: (key: string) => `${key} Schubladenflächenorganisationsprinzip `.repeat(3),
          measure: roughMeasure,
        })
      );
      expectFits(scene);
    }
  });

  it('names a missing number with no card', () => {
    expect(
      buildScene(sceneInput('biggest', { stats: { ...sampleStats, biggestDrawer: null } }))
    ).toBeNull();
    expect(buildScene(sceneInput('complicated', { complicated: null }))).toBeNull();
  });

  it('draws the biggest drawer even when the library has no preview of it', () => {
    expectFits(buildScene(sceneInput('biggest', { drawerPreview: null })));
  });

  it('sets the sample lines in their concept roles', () => {
    const size = buildScene(sceneInput('size'));
    expect(size?.texts.find((b) => b.key === 'kicker')?.lines).toEqual(['Your size:']);
    const biggest = buildScene(sceneInput('biggest'));
    expect(biggest?.texts.find((b) => b.key === 'value')?.lines.join(' ')).toBe('966 × 798 mm.');
    expect(biggest?.texts.find((b) => b.key === 'after')?.lines).toEqual(['“Workbench”']);
    const bins = buildScene(sceneInput('bins'));
    expect(bins?.texts.filter((b) => b.key.startsWith('line'))).toHaveLength(2);
  });
});

describe('layouts that follow the data', () => {
  it('shuts one drawer per drawer, up to a full chest', () => {
    expect(chestLayout(1, 400, 800).slots).toHaveLength(1);
    expect(chestLayout(5, 400, 800).slots.at(-1)?.w).toBeGreaterThan(
      chestLayout(5, 400, 800).slots[0]?.w ?? 0
    );
    expect(chestLayout(40, 400, 800).slots).toHaveLength(MAX_DRAWERS);
    expect(chestLayout(12, 400, 500).height).toBeLessThanOrEqual(500);
    expect(rowContact(5, 6)).toBeLessThanOrEqual(4 * (60 / 88));
  });

  it('packs one designed bin per design onto at most four shelves', () => {
    expect(packShelves(1)).toHaveLength(1);
    expect(packShelves(34)).toHaveLength(34);
    expect(new Set(packShelves(34).map((bin) => bin.shelf)).size).toBe(4);
    expect(packShelves(500).length).toBeLessThanOrEqual(36);
  });

  it('stacks the busiest month tallest, a bin an item while it fits', () => {
    expect(monthStacks([2, 19, 0]).stacks).toEqual([2, 19, 0]);
    const big = monthStacks([400, 1, 0]);
    expect(big.stacks[0]).toBe(MAX_STACK);
    expect(big.stacks[1]).toBe(1);
    expect(monthStacks([1, 0]).pitch).toBeGreaterThan(monthStacks([19, 0]).pitch);
  });

  it('caps the spools, the plate and the supporters', () => {
    expect(spoolSpots(250)).toHaveLength(MAX_SPOOLS);
    expect(spoolSpots(1)).toHaveLength(1);
    expect(plateGrid(5000).filled).toBe(MAX_PLATE);
    expect(plateGrid(3)).toEqual({ side: 2, filled: 3, spaghetti: 1 });
    expect(plateGrid(1).spaghetti).toBe(-1);
    expect(supporterSpots(4000)).toHaveLength(MAX_SUPPORTER_BINS);
    expect(supporterSpots(7).every((spot) => spot.r === 0)).toBe(true);
  });
});
