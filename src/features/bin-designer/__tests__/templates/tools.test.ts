import { describe, it, expect } from 'vitest';
import { TOOLS_TEMPLATES } from '../../templates/tools';
import { ALL_TEMPLATES, getTemplatesByCategory, getTemplateById } from '../../templates';

describe('tools templates', () => {
  it('has 13 tools templates', () => {
    expect(TOOLS_TEMPLATES).toHaveLength(13);
  });

  it('all templates have unique IDs', () => {
    const ids = TOOLS_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates are in the tools category', () => {
    for (const template of TOOLS_TEMPLATES) {
      expect(template.category).toBe('tools');
    }
  });

  it('all templates have valid shapes matching their defaults', () => {
    for (const template of TOOLS_TEMPLATES) {
      expect(template.defaults.shape).toBe(template.shape);
    }
  });

  it('all templates have positive dimensions', () => {
    for (const template of TOOLS_TEMPLATES) {
      expect(template.defaults.width).toBeGreaterThan(0);
      expect(template.defaults.depth).toBeGreaterThan(0);
      expect(template.defaults.cutDepth).toBeGreaterThan(0);
    }
  });

  it('marker templates use circle shape (upright holders)', () => {
    const markers = TOOLS_TEMPLATES.filter((t) => t.id.startsWith('marker-'));
    expect(markers.length).toBe(3); // fine, sharpie, thick
    for (const marker of markers) {
      expect(marker.shape).toBe('circle');
    }
  });

  it('pliers templates use rounded-rect shape', () => {
    const pliers = TOOLS_TEMPLATES.filter((t) => t.id.startsWith('pliers-'));
    expect(pliers.length).toBe(2);
    for (const p of pliers) {
      expect(p.shape).toBe('rounded-rect');
    }
  });

  it('knife templates use rounded-rect shape', () => {
    const knives = TOOLS_TEMPLATES.filter((t) => t.id.includes('knife'));
    expect(knives.length).toBe(2);
    for (const knife of knives) {
      expect(knife.shape).toBe('rounded-rect');
    }
  });

  it('screwdriver lying flat uses slot shape', () => {
    const lying = getTemplateById('screwdriver-handle');
    expect(lying).toBeDefined();
    expect(lying!.shape).toBe('slot');
    expect(lying!.defaults.shape).toBe('slot');
  });

  it('sharpie marker has correct clearance-adjusted dimensions', () => {
    const marker = getTemplateById('marker-sharpie');
    expect(marker).toBeDefined();
    // 12mm + 1.0mm tools clearance = 13mm
    expect(marker!.defaults.width).toBe(13);
    expect(marker!.defaults.depth).toBe(13);
    expect(marker!.defaults.cutDepth).toBe(110);
  });

  it('utility knife has correct dimensions', () => {
    const knife = getTemplateById('utility-knife');
    expect(knife).toBeDefined();
    // 18mm + 1.0 = 19mm, 150mm + 1.0 = 151mm
    expect(knife!.defaults.width).toBe(19);
    expect(knife!.defaults.depth).toBe(151);
  });

  it('tape measure (3m) has correct dimensions', () => {
    const tape = getTemplateById('tape-measure-small');
    expect(tape).toBeDefined();
    // 65 + 1.0 = 66, 35 + 1.0 = 36
    expect(tape!.defaults.width).toBe(66);
    expect(tape!.defaults.cutDepth).toBe(36);
  });

  it('circular templates have equal width and depth', () => {
    const circular = TOOLS_TEMPLATES.filter((t) => t.shape === 'circle');
    for (const template of circular) {
      expect(template.defaults.width).toBe(template.defaults.depth);
    }
  });

  it('all configurable params reference valid insert keys', () => {
    const validKeys = ['width', 'depth', 'cutDepth', 'rotation', 'cornerRadius', 'label'];
    for (const template of TOOLS_TEMPLATES) {
      for (const param of template.configurableParams) {
        expect(validKeys).toContain(param.key);
      }
    }
  });

  it('configurable param min is less than max', () => {
    for (const template of TOOLS_TEMPLATES) {
      for (const param of template.configurableParams) {
        expect(param.min).toBeLessThan(param.max);
      }
    }
  });

  it('tools with rotation param allow 90° increments', () => {
    for (const template of TOOLS_TEMPLATES) {
      const rotationParam = template.configurableParams.find((p) => p.key === 'rotation');
      if (rotationParam) {
        expect(rotationParam.step).toBe(90);
        expect(rotationParam.max).toBe(270);
      }
    }
  });

  it('getTemplatesByCategory returns all tools templates', () => {
    const tools = getTemplatesByCategory('tools');
    expect(tools.length).toBe(13);
  });

  it('ALL_TEMPLATES includes all tools templates', () => {
    for (const template of TOOLS_TEMPLATES) {
      expect(ALL_TEMPLATES).toContain(template);
    }
  });
});
