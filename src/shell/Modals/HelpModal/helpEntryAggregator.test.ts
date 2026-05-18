import { describe, it, expect } from 'vitest';
import { getAllHelpEntries } from './helpEntryAggregator';

describe('getAllHelpEntries', () => {
  it('aggregates shortcut, feature, and shell entries into one flat list', () => {
    const entries = getAllHelpEntries();
    expect(entries.length).toBeGreaterThan(0);

    const kinds = new Set(entries.map((e) => e.kind));
    expect(kinds.has('shortcut')).toBe(true);
    expect(kinds.has('feature')).toBe(true);
  });

  it('includes the print-bed-size and half-bin-mode proof-of-concept entries', () => {
    const ids = getAllHelpEntries().map((e) => e.id);
    expect(ids).toContain('feature/grid-editor/print-bed-size');
    expect(ids).toContain('feature/shell/half-bin-mode');
  });

  it('produces unique ids across all entries', () => {
    const ids = getAllHelpEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('feature entries always carry a target', () => {
    const features = getAllHelpEntries().filter((e) => e.kind === 'feature');
    for (const feature of features) {
      expect(feature.target.surface).toBeTruthy();
      expect(feature.target.controlId).toBeTruthy();
    }
  });
});
