import { describe, it, expect } from 'vitest';
import { SETTINGS_REGISTRY } from './settingsRegistry';
import { TAB_DEFINITIONS } from './tabDefinitions';

describe('SETTINGS_REGISTRY', () => {
  it('has unique section ids', () => {
    const ids = SETTINGS_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references valid tab ids', () => {
    const validTabs = new Set(TAB_DEFINITIONS.map((tab) => tab.id));
    for (const entry of SETTINGS_REGISTRY) {
      expect(validTabs.has(entry.tabId)).toBe(true);
    }
  });

  it('uses settings.* label keys', () => {
    for (const entry of SETTINGS_REGISTRY) {
      expect(entry.labelKey.startsWith('settings.')).toBe(true);
    }
  });

  it('covers every tab with at least one searchable section', () => {
    const coveredTabs = new Set(SETTINGS_REGISTRY.map((entry) => entry.tabId));
    for (const tab of TAB_DEFINITIONS) {
      expect(coveredTabs.has(tab.id)).toBe(true);
    }
  });
});
