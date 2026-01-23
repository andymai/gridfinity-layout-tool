import { describe, it, expect } from 'vitest';
import { ELECTRONICS_TEMPLATES } from '../../templates/electronics';
import { ALL_TEMPLATES, getTemplatesByCategory, getTemplateById } from '../../templates';

describe('electronics templates', () => {
  it('has 8 electronics templates', () => {
    expect(ELECTRONICS_TEMPLATES).toHaveLength(8);
  });

  it('all templates have unique IDs', () => {
    const ids = ELECTRONICS_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates are in the electronics category', () => {
    for (const template of ELECTRONICS_TEMPLATES) {
      expect(template.category).toBe('electronics');
    }
  });

  it('all templates have valid shapes matching their defaults', () => {
    for (const template of ELECTRONICS_TEMPLATES) {
      expect(template.defaults.shape).toBe(template.shape);
    }
  });

  it('all templates have positive dimensions', () => {
    for (const template of ELECTRONICS_TEMPLATES) {
      expect(template.defaults.width).toBeGreaterThan(0);
      expect(template.defaults.depth).toBeGreaterThan(0);
      expect(template.defaults.cutDepth).toBeGreaterThan(0);
    }
  });

  it('circular templates have equal width and depth', () => {
    const circular = ELECTRONICS_TEMPLATES.filter((t) => t.shape === 'circle');
    for (const template of circular) {
      expect(template.defaults.width).toBe(template.defaults.depth);
    }
  });

  it('all configurable params reference valid insert keys', () => {
    const validKeys = ['width', 'depth', 'cutDepth', 'rotation', 'cornerRadius', 'label'];
    for (const template of ELECTRONICS_TEMPLATES) {
      for (const param of template.configurableParams) {
        expect(validKeys).toContain(param.key);
      }
    }
  });

  it('AA battery has correct clearance-adjusted dimensions', () => {
    const aa = getTemplateById('battery-aa');
    expect(aa).toBeDefined();
    expect(aa!.defaults.width).toBe(15); // 14.5 + 0.5 clearance
    expect(aa!.defaults.cutDepth).toBe(51); // 50.5 + 0.5 clearance
  });

  it('getTemplatesByCategory returns only matching templates', () => {
    const electronics = getTemplatesByCategory('electronics');
    expect(electronics.length).toBe(8);
    // Hardware and tools now have templates too
    expect(getTemplatesByCategory('hardware').length).toBeGreaterThan(0);
    expect(getTemplatesByCategory('tools').length).toBeGreaterThan(0);
  });

  it('ALL_TEMPLATES includes all electronics templates', () => {
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(ELECTRONICS_TEMPLATES.length);
    for (const template of ELECTRONICS_TEMPLATES) {
      expect(ALL_TEMPLATES).toContain(template);
    }
  });
});
