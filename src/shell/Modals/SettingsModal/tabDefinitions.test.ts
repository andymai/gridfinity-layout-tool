import { describe, it, expect } from 'vitest';
import { TAB_DEFINITIONS, TAB_GROUPS } from './tabDefinitions';

describe('TAB_DEFINITIONS', () => {
  it('has exactly 10 tab definitions', () => {
    expect(TAB_DEFINITIONS).toHaveLength(10);
  });

  it('every tab has id, labelKey, and icon', () => {
    for (const tab of TAB_DEFINITIONS) {
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('labelKey');
      expect(tab).toHaveProperty('icon');
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.labelKey).toBe('string');
      expect(typeof tab.icon).toBe('function');
    }
  });

  it('tab ids match expected set and order (flattened from groups)', () => {
    const ids = TAB_DEFINITIONS.map((t) => t.id);
    expect(ids).toEqual([
      'general',
      'appearance',
      'defaults',
      'print',
      'categories',
      'account',
      'privacy',
      'storage',
      'integrations',
      'labs',
    ]);
  });

  it('all labelKeys follow settings.tabs.* pattern', () => {
    for (const tab of TAB_DEFINITIONS) {
      expect(tab.labelKey).toMatch(/^settings\.tabs\.\w+$/);
    }
  });

  it('preserves the externally-referenced account tab id', () => {
    // UserDock opens the modal with initialTab="account"; the id must persist.
    expect(TAB_DEFINITIONS.some((t) => t.id === 'account')).toBe(true);
  });
});

describe('TAB_GROUPS', () => {
  it('flattens to exactly the TAB_DEFINITIONS list', () => {
    const flattened = TAB_GROUPS.flatMap((group) => group.tabs);
    expect(flattened).toEqual(TAB_DEFINITIONS);
  });

  it('every group has a labelKey and at least one tab', () => {
    for (const group of TAB_GROUPS) {
      expect(group.labelKey).toMatch(/^settings\.groups\.\w+$/);
      expect(group.tabs.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate tab ids across groups', () => {
    const ids = TAB_GROUPS.flatMap((group) => group.tabs.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
