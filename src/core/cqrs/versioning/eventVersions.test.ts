import { describe, it, expect } from 'vitest';
import { CURRENT_EVENT_VERSIONS } from './eventVersions';

describe('eventVersions', () => {
  it('has entries and all versions are positive integers', () => {
    const entries = Object.entries(CURRENT_EVENT_VERSIONS);
    expect(entries.length).toBeGreaterThan(0);

    for (const [type, version] of entries) {
      expect(version, `${type} should have positive integer version`).toBeGreaterThan(0);
      expect(Number.isInteger(version), `${type} version should be integer`).toBe(true);
    }
  });

  it('covers all expected event domains', () => {
    const types = Object.keys(CURRENT_EVENT_VERSIONS);
    const domains = [...new Set(types.map((t) => t.split('.')[0]))];

    expect(domains).toContain('bin');
    expect(domains).toContain('layer');
    expect(domains).toContain('category');
    expect(domains).toContain('drawer');
    expect(domains).toContain('layout');
    expect(domains).toContain('library');
    expect(domains).toContain('designer');
  });

  it('no entry has undefined or zero version', () => {
    for (const [type, version] of Object.entries(CURRENT_EVENT_VERSIONS)) {
      expect(version, `${type} should not be undefined`).toBeDefined();
      expect(version, `${type} should not be zero`).not.toBe(0);
    }
  });
});
