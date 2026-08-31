import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerSettingsSearch } from './useDesignerSettingsSearch';
import type { ControlAvailabilityContext } from './designerControlRegistry';

/**
 * Coverage eval: representative queries mapped to labels that MUST appear. This
 * is how "no gaps" is defined and defended — a new gap either fails a case here
 * or gets added as one. Labels are the English (en.ts) values the test i18n mock
 * resolves. Run with every control available so the eval measures the index, not
 * the current params.
 */
const ALL_AVAILABLE: ControlAvailabilityContext = {
  style: 'standard',
  hasText: true,
  needsSplit: true,
  viewMode: 'rail',
  slideTrayEnabled: true,
};

const GOLDEN: { query: string; expect: string[] }[] = [
  { query: 'floor', expect: ['Lightweight floor', 'Floor pattern'] },
  { query: 'lightweight', expect: ['Lightweight floor'] },
  { query: 'honeycomb', expect: ['Lightweight floor'] },
  { query: 'magnet', expect: ['Magnet holes'] },
  { query: 'screw', expect: ['Screw holes'] },
  { query: 'stacking lip', expect: ['Stacking lip'] },
  { query: 'feet', expect: ['Detachable feet'] },
  { query: 'spacer', expect: ['Spacer'] },
  { query: 'flat base', expect: ['Flat base'] },
  { query: 'pry', expect: ['Lid grip'] },
  { query: 'scallop', expect: ['Lid grip'] },
  { query: 'half', expect: ['Half-grid mode'] },
  { query: 'taper', expect: ['Taper walls'] },
  { query: 'custom shape', expect: ['Custom shape'] },
  { query: 'hex', expect: ['Wall surface pattern'] },
  { query: 'drainage', expect: ['Floor pattern'] },
  { query: 'font', expect: ['Typeface'] },
  { query: 'engrave', expect: ['Typography'] },
  { query: 'nozzle', expect: ['Nozzle size'] },
  { query: 'grid unit', expect: ['Grid unit'] },
  { query: 'split', expect: ['Alignment connectors'] },
];

describe('designer search coverage (golden set)', () => {
  it('surfaces the expected result for every representative query', () => {
    const failures: string[] = [];
    for (const { query, expect: wanted } of GOLDEN) {
      const { result } = renderHook(() => useDesignerSettingsSearch(query, ALL_AVAILABLE));
      const got = new Set(result.current.map((r) => r.label));
      for (const label of wanted) {
        if (!got.has(label)) failures.push(`"${query}" → missing "${label}"`);
      }
    }
    expect(failures).toEqual([]);
  });
});
