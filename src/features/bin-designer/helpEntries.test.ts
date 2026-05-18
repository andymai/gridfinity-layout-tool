import { describe, it, expect } from 'vitest';
import { helpEntries } from './helpEntries';

describe('bin-designer helpEntries', () => {
  it('includes a print-bed-size entry pointing at the physical-units marker', () => {
    expect(helpEntries).toContainEqual(
      expect.objectContaining({
        id: 'feature/bin-designer/print-bed-size',
        kind: 'feature',
        routes: ['designer'],
        target: { surface: 'binDesigner:base', controlId: 'bd-physical-units' },
      })
    );
  });

  it('every entry is scoped to the designer route', () => {
    for (const entry of helpEntries) {
      expect(entry.routes).toEqual(['designer']);
    }
  });

  it('every entry references i18n keys (no inline strings)', () => {
    for (const entry of helpEntries) {
      expect(entry.titleKey).toMatch(/^help\.target\.binDesigner\./);
      expect(entry.descriptionKey).toMatch(/^help\.target\.binDesigner\./);
    }
  });
});
