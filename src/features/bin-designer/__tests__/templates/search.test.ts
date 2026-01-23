import { describe, it, expect } from 'vitest';
import { searchTemplates, ALL_TEMPLATES, AVAILABLE_CATEGORIES } from '../../templates';

describe('searchTemplates', () => {
  it('returns all templates for empty query', () => {
    expect(searchTemplates('')).toBe(ALL_TEMPLATES);
  });

  it('returns all templates for whitespace-only query', () => {
    expect(searchTemplates('   ')).toBe(ALL_TEMPLATES);
  });

  it('searches by template name', () => {
    const results = searchTemplates('AA Battery');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((t) => t.id === 'battery-aa')).toBe(true);
  });

  it('searches by partial name', () => {
    const results = searchTemplates('Hex Key');
    // Should find hex key templates (hardware)
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('searches case-insensitively', () => {
    const lower = searchTemplates('driver bit');
    const upper = searchTemplates('DRIVER BIT');
    const mixed = searchTemplates('Driver Bit');

    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
  });

  it('searches template descriptions', () => {
    // "hexagonal pocket" appears in hardware hex key descriptions
    const results = searchTemplates('hexagonal pocket');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.category).toBe('hardware');
    }
  });

  it('searches template labels', () => {
    // "Bit" is the label for quarter-inch driver bit
    const results = searchTemplates('Bit');
    expect(results.some((t) => t.id === 'bit-quarter-inch')).toBe(true);
  });

  it('returns empty array for non-matching query', () => {
    const results = searchTemplates('xyznonexistent');
    expect(results).toHaveLength(0);
  });

  it('can find templates across all categories', () => {
    // "standing upright" appears in both electronics and hardware descriptions
    const results = searchTemplates('standing upright');
    const categories = new Set(results.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(1);
  });

  it('finds quarter-inch bit by symbol', () => {
    const results = searchTemplates('¼"');
    expect(results.some((t) => t.id === 'bit-quarter-inch')).toBe(true);
  });

  it('finds utility knife templates', () => {
    const results = searchTemplates('knife');
    expect(results.length).toBe(2); // utility-knife and utility-knife-compact
    for (const result of results) {
      expect(result.id).toContain('knife');
    }
  });
});

describe('AVAILABLE_CATEGORIES', () => {
  it('includes all three categories', () => {
    expect(AVAILABLE_CATEGORIES).toContain('electronics');
    expect(AVAILABLE_CATEGORIES).toContain('hardware');
    expect(AVAILABLE_CATEGORIES).toContain('tools');
  });

  it('has no duplicates', () => {
    expect(new Set(AVAILABLE_CATEGORIES).size).toBe(AVAILABLE_CATEGORIES.length);
  });
});

describe('ALL_TEMPLATES', () => {
  it('has unique IDs across all categories', () => {
    const ids = ALL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('total count matches sum of categories', () => {
    const electronics = ALL_TEMPLATES.filter((t) => t.category === 'electronics');
    const hardware = ALL_TEMPLATES.filter((t) => t.category === 'hardware');
    const tools = ALL_TEMPLATES.filter((t) => t.category === 'tools');
    expect(ALL_TEMPLATES.length).toBe(electronics.length + hardware.length + tools.length);
  });

  it('all templates have non-empty names and descriptions', () => {
    for (const template of ALL_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
  });

  it('all templates have at least one configurable param', () => {
    for (const template of ALL_TEMPLATES) {
      expect(template.configurableParams.length).toBeGreaterThanOrEqual(1);
    }
  });
});
