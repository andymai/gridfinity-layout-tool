import { describe, it, expect } from 'vitest';
import { TAB_DEFINITIONS } from './tabDefinitions';

describe('TAB_DEFINITIONS', () => {
  it('has exactly 8 tab definitions', () => {
    expect(TAB_DEFINITIONS).toHaveLength(8);
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

  it('tab ids match expected set', () => {
    const ids = TAB_DEFINITIONS.map((t) => t.id);
    expect(ids).toEqual([
      'general',
      'appearance',
      'account',
      'defaults',
      'integrations',
      'privacy',
      'storage',
      'labs',
    ]);
  });

  it('all labelKeys follow settings.tabs.* pattern', () => {
    for (const tab of TAB_DEFINITIONS) {
      expect(tab.labelKey).toMatch(/^settings\.tabs\.\w+$/);
    }
  });
});
