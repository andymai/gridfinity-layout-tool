import { describe, it, expect } from 'vitest';
import { helpEntries } from './helpEntries';

describe('baseplate helpEntries', () => {
  it('exports a print-bed-size entry scoped to the baseplate route', () => {
    expect(helpEntries).toContainEqual(
      expect.objectContaining({
        id: 'feature/baseplate/print-bed-size',
        kind: 'feature',
        routes: ['baseplate'],
        target: { surface: 'baseplate:print-settings', controlId: 'bp-print-bed-size' },
      })
    );
  });

  it('every entry references i18n keys (no inline strings)', () => {
    for (const entry of helpEntries) {
      expect(entry.titleKey).toMatch(/^help\.target\./);
      expect(entry.descriptionKey).toMatch(/^help\.target\./);
    }
  });
});
