import { describe, it, expect } from 'vitest';
import { getDisplayTerm } from '@/shared/analytics/labelVocabulary';
import { computeGhost, getLabelSuggestions } from './getLabelSuggestions';
import type { SuggestionBin, SuggestionContext } from './types';

let counter = 0;
function makeBin(overrides: Partial<SuggestionBin> = {}): SuggestionBin {
  return {
    id: `b${counter++}`,
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    layerId: 'L0',
    category: 'c1',
    label: '',
    ...overrides,
  };
}

function ctx(target: SuggestionBin, ...rest: SuggestionBin[]): SuggestionContext {
  return { target, bins: [target, ...rest] };
}

describe('getLabelSuggestions', () => {
  it('predicts the next item in a series before the user types', () => {
    const target = makeBin({ x: 2, label: '' });
    const context = ctx(
      target,
      makeBin({ x: 0, label: 'M3 screws' }),
      makeBin({ x: 1, label: 'M4 screws' })
    );
    const results = getLabelSuggestions('', context);
    expect(results[0]?.value).toBe('M5 screws');
    expect(results[0]?.reason).toBe('nextInSet');
  });

  it("suggests a neighbor's label with the matchesNeighbors reason", () => {
    // Neighbor shares the right edge of the target, same layer.
    const target = makeBin({ x: 0, category: 'c1', label: '' });
    const neighbor = makeBin({ x: 1, category: 'c2', label: 'Bolts' });
    const results = getLabelSuggestions('', ctx(target, neighbor));
    expect(results[0]?.value).toBe('Bolts');
    expect(results[0]?.reason).toBe('matchesNeighbors');
  });

  it('ranks a reused label with a usage count while typing', () => {
    const target = makeBin({ x: 0, category: 'c1', label: 'wid' });
    const reused = [
      makeBin({ x: 5, category: 'c9', label: 'Widgets' }),
      makeBin({ x: 7, category: 'c9', label: 'Widgets' }),
      makeBin({ x: 9, category: 'c9', label: 'Widgets' }),
    ];
    const results = getLabelSuggestions('wid', ctx(target, ...reused));
    const top = results[0];
    expect(top?.value).toBe('Widgets');
    expect(top?.reason).toBe('usedBefore');
    expect(top?.count).toBe(3);
  });

  it('offers catalog terms by prefix while typing', () => {
    const results = getLabelSuggestions('screwd', ctx(makeBin({ label: 'screwd' })));
    const match = results.find((r) => r.value === 'Screwdriver');
    expect(match).toBeDefined();
    expect(match?.reason).toBe('catalog');
  });

  it('tolerates typos via fuzzy matching (similar reason)', () => {
    const results = getLabelSuggestions('screwdrivr', ctx(makeBin({ label: 'screwdrivr' })));
    const match = results.find((r) => r.value === 'Screwdriver');
    expect(match).toBeDefined();
    expect(match?.reason).toBe('similar');
  });

  it('surfaces domain-related catalog terms from neighbor context (similar)', () => {
    const target = makeBin({ x: 0, category: 'c1', label: '' });
    const neighbor = makeBin({ x: 1, category: 'c1', label: 'Resistor' });
    const results = getLabelSuggestions('', ctx(target, neighbor));
    expect(results.some((r) => r.reason === 'similar')).toBe(true);
  });

  it('shows nothing before typing when there is no context', () => {
    const results = getLabelSuggestions('', ctx(makeBin({ label: '' })));
    expect(results).toEqual([]);
  });

  it("never suggests the bin's own current label", () => {
    const target = makeBin({ label: 'Widgets' });
    const results = getLabelSuggestions(
      'Widgets',
      ctx(target, makeBin({ x: 5, label: 'Widgets' }))
    );
    expect(results.every((r) => r.value.toLowerCase() !== 'widgets')).toBe(true);
  });

  it('respects the limit', () => {
    const target = makeBin({ label: 's' });
    const results = getLabelSuggestions('s', ctx(target), { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('expands a typed concept word to its whole domain (similar)', () => {
    const results = getLabelSuggestions('fasteners', ctx(makeBin({ label: 'fasteners' })));
    const values = results.map((r) => r.value);
    for (const term of ['screw', 'bolt', 'nut']) {
      expect(values).toContain(getDisplayTerm(term));
    }
    const screw = results.find((r) => r.value === getDisplayTerm('screw'));
    expect(screw?.reason).toBe('similar');
  });

  it('surfaces related items for a typed term (similar)', () => {
    // "screwd" resolves to the "screw" canonical, whose related items include
    // bolt/nut/washer — none of which share the typed letters.
    const results = getLabelSuggestions('screwd', ctx(makeBin({ label: 'screwd' })));
    const bolt = results.find((r) => r.value === getDisplayTerm('bolt'));
    expect(bolt).toBeDefined();
    expect(bolt?.reason).toBe('similar');
    // The literal prefix match still wins the top slot.
    expect(results[0]?.value).toBe(getDisplayTerm('screwdriver'));
  });

  it('ranks a literal match above a higher-scoring meaning-only match', () => {
    // Neighbor "Bolt" shares an edge and is semantically related to screw, so it
    // accrues neighbor + semantic score — but it doesn't match the typed letters.
    const target = makeBin({ x: 0, category: 'c1', label: 'screw' });
    const neighbor = makeBin({ x: 1, category: 'c1', label: 'Bolt' });
    const results = getLabelSuggestions('screw', ctx(target, neighbor));
    expect(results[0]?.value).toBe(getDisplayTerm('screwdriver'));
    const boltIndex = results.findIndex((r) => r.value === 'Bolt');
    expect(boltIndex).toBeGreaterThan(0);
  });

  it('never returns a suggestion longer than maxLength', () => {
    const target = makeBin({ label: 'scr' });
    const results = getLabelSuggestions('scr', ctx(target), { maxLength: 5 });
    expect(results.every((r) => r.value.length <= 5)).toBe(true);
    // "Screwdriver" (11 chars) must be excluded even though it matches.
    expect(results.some((r) => r.value === 'Screwdriver')).toBe(false);
  });
});

describe('computeGhost', () => {
  it('completes a confident prefix suggestion', () => {
    const suggestions = getLabelSuggestions('screwd', ctx(makeBin({ label: 'screwd' })));
    const ghost = computeGhost('screwd', suggestions);
    expect(ghost?.value).toBe('Screwdriver');
    expect(ghost?.completion).toBe('river');
  });

  it('offers the full prediction as ghost before typing', () => {
    const target = makeBin({ x: 2, label: '' });
    const context = ctx(
      target,
      makeBin({ x: 0, label: 'M3 screws' }),
      makeBin({ x: 1, label: 'M4 screws' })
    );
    const suggestions = getLabelSuggestions('', context);
    const ghost = computeGhost('', suggestions);
    expect(ghost?.value).toBe('M5 screws');
    expect(ghost?.completion).toBe('M5 screws');
  });

  it('returns null when the top suggestion is weak', () => {
    expect(computeGhost('zzz', [])).toBeNull();
  });

  it('slices the completion at the literal caret offset', () => {
    const suggestions = [{ value: 'M5 screws', reason: 'nextInSet' as const, score: 2 }];
    expect(computeGhost('M5 ', suggestions)?.completion).toBe('screws');
    expect(computeGhost('M5', suggestions)?.completion).toBe(' screws');
    // Leading whitespace the value doesn't start with yields no ghost (safe).
    expect(computeGhost('  M5', suggestions)).toBeNull();
  });
});
