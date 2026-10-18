import { describe, expect, it } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import type { Bin, Layout, SlantConfig } from '@/core/types';
import { binId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import { getSlantIssues, matchRowSlants, rowCanMatch, slantIssue, slantRowOf } from './slantRow';

const L1 = layerId('layer1');
const L2 = layerId('layer2');
// 45° over a 6-unit body: the top reaches 37 mm (0.9 cells) past the base.
const BACK: SlantConfig = { angleDeg: 45, side: 'back' };

function bin(id: string, y: number, overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    id: binId(id),
    y: gridUnits(y),
    width: gridUnits(2),
    height: heightUnits(6),
    ...overrides,
  });
}

function layoutOf(bins: Bin[], overrides: Partial<Layout> = {}): Layout {
  return createTestLayout({
    layers: [
      { id: L1, name: 'Layer 1', height: heightUnits(3) },
      { id: L2, name: 'Layer 2', height: heightUnits(3) },
    ],
    bins,
    ...overrides,
  });
}

function issueOf(id: string, bins: Bin[], overrides: Partial<Layout> = {}) {
  const layout = layoutOf(bins, overrides);
  const target = layout.bins.find((b) => b.id === id);
  if (!target) throw new Error(`no bin ${id}`);
  return slantIssue(target, layout);
}

describe('slantIssue', () => {
  it('has nothing to say about an upright or stashed bin', () => {
    expect(issueOf('a', [bin('a', 0)])).toBeNull();
    expect(issueOf('a', [bin('a', 0, { slant: BACK, layerId: STAGING_ID })])).toBeNull();
  });

  it('flags a top leaning over a bin that does not lean the same way', () => {
    expect(issueOf('a', [bin('a', 0, { slant: BACK }), bin('b', 1)])).toBe('mismatch');
    const steeper = { ...BACK, angleDeg: 50 };
    expect(issueOf('a', [bin('a', 0, { slant: BACK }), bin('b', 1, { slant: steeper })])).toBe(
      'mismatch'
    );
  });

  it('accepts a row that leans alike, and flags its open end', () => {
    const row = [bin('a', 0, { slant: BACK }), bin('b', 1, { slant: BACK })];
    expect(issueOf('a', row)).toBeNull();
    expect(issueOf('b', row)).toBe('unsupported');
  });

  it('accepts a row that ends on its support', () => {
    const row = [
      bin('a', 0, { slant: BACK }),
      bin('b', 1, { slant: { ...BACK, endSupport: true } }),
    ];
    expect(issueOf('b', row)).toBeNull();
  });

  it('flags a top leaning past the drawer, unless the margin takes it', () => {
    const atBack = [bin('a', 7, { slant: BACK })];
    expect(issueOf('a', atBack)).toBe('pastDrawer');
    const baseplateParams = {
      magnetHoles: false,
      magnetDiameter: mm(6),
      magnetDepth: mm(2),
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingFront: mm(0),
      paddingBack: mm(40),
    };
    expect(issueOf('a', atBack, { baseplateParams })).toBe('unsupported');
  });

  it('flags a support on taken cells, or a bin stacked over the slant', () => {
    const support = { ...BACK, endSupport: true };
    expect(issueOf('a', [bin('a', 0, { slant: support }), bin('b', 1)])).toBe('blocked');
    expect(issueOf('a', [bin('a', 7, { slant: support })])).toBe('blocked');
    expect(issueOf('a', [bin('a', 0, { slant: BACK }), bin('o', 0, { layerId: L2 })])).toBe(
      'blocked'
    );
  });
});

describe('slantRowOf', () => {
  it('walks the bins edge to edge along the axis, in order', () => {
    const bins = [bin('c', 2), bin('a', 0), bin('b', 1), bin('gap', 4)];
    expect(slantRowOf(bins[2], 'y', { bins }).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('stops at a bin with a different cross extent or on another layer', () => {
    const bins = [
      bin('a', 0),
      bin('wide', 1, { width: gridUnits(3) }),
      bin('up', 1, { layerId: L2 }),
    ];
    expect(slantRowOf(bins[0], 'y', { bins }).map((b) => b.id)).toEqual(['a']);
  });
});

describe('matchRowSlants', () => {
  it("gives the row the bin's slant and the leading bin the end support, listed last", () => {
    const layout = layoutOf([bin('a', 0), bin('b', 1, { slant: BACK }), bin('c', 2)]);
    const [, b] = layout.bins;
    expect(matchRowSlants(b, layout)).toEqual([
      { id: 'a', slant: BACK },
      { id: 'b', slant: BACK },
      { id: 'c', slant: { ...BACK, endSupport: true } },
    ]);
  });

  it('leads from the front for a front lean', () => {
    const FRONT: SlantConfig = { angleDeg: 30, side: 'front' };
    const layout = layoutOf([bin('a', 1), bin('b', 2, { slant: FRONT })]);
    expect(matchRowSlants(layout.bins[1], layout).at(-1)).toEqual({
      id: 'a',
      slant: { ...FRONT, endSupport: true },
    });
  });

  it('has nothing to match for an upright bin', () => {
    const layout = layoutOf([bin('a', 0), bin('b', 1)]);
    expect(matchRowSlants(layout.bins[0], layout)).toEqual([]);
  });
});

describe('rowCanMatch', () => {
  it('can match a row whose differing neighbour stands in it', () => {
    const layout = layoutOf([bin('a', 0, { slant: BACK }), bin('b', 1)]);
    expect(rowCanMatch(layout.bins[0], layout)).toBe(true);
  });

  it('cannot match past a neighbour of another width, which is not in the row', () => {
    const layout = layoutOf([
      bin('a', 0, { slant: BACK }),
      bin('wide', 1, { width: gridUnits(3) }),
    ]);
    expect(slantIssue(layout.bins[0], layout)).toBe('mismatch');
    expect(rowCanMatch(layout.bins[0], layout)).toBe(false);
  });
});

describe('getSlantIssues', () => {
  it('names every bin with an issue, once per layout', () => {
    const layout = layoutOf([bin('a', 0, { slant: BACK }), bin('b', 1), bin('c', 3)]);
    const issues = getSlantIssues(layout, 'k');
    expect([...issues]).toEqual([['a', 'mismatch']]);
    expect(getSlantIssues(layout, 'k')).toBe(issues);
    expect(getSlantIssues(layout, 'other')).not.toBe(issues);
  });
});
