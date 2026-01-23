import { describe, it, expect } from 'vitest';
import { HARDWARE_TEMPLATES } from '../../templates/hardware';
import { ALL_TEMPLATES, getTemplatesByCategory, getTemplateById } from '../../templates';

describe('hardware templates', () => {
  it('has 5 hardware templates', () => {
    expect(HARDWARE_TEMPLATES).toHaveLength(5);
  });

  it('all templates have unique IDs', () => {
    const ids = HARDWARE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates are in the hardware category', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(template.category).toBe('hardware');
    }
  });

  it('all templates have valid shapes matching their defaults', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(template.defaults.shape).toBe(template.shape);
    }
  });

  it('all templates have positive dimensions', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(template.defaults.width).toBeGreaterThan(0);
      expect(template.defaults.depth).toBeGreaterThan(0);
      expect(template.defaults.cutDepth).toBeGreaterThan(0);
    }
  });

  it('all templates use hexagon shape', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(template.shape).toBe('hexagon');
    }
  });

  it('hex key templates have correct IDs', () => {
    const keys = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('hex-key'));
    expect(keys.length).toBe(3);
  });

  it('bit holder templates have correct IDs', () => {
    const bits = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('bit-'));
    expect(bits.length).toBe(2);
  });

  it('quarter-inch bit has correct dimension', () => {
    const bit = getTemplateById('bit-quarter-inch');
    if (!bit) return;
    // 6.35mm + 0.5 clearance = 6.85
    expect(bit.defaults.width).toBe(6.85);
  });

  it('all templates have equal width and depth', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(template.defaults.width).toBe(template.defaults.depth);
    }
  });

  it('all configurable params reference valid insert keys', () => {
    const validKeys = ['width', 'depth', 'cutDepth', 'rotation', 'cornerRadius', 'label'];
    for (const template of HARDWARE_TEMPLATES) {
      for (const param of template.configurableParams) {
        expect(validKeys).toContain(param.key);
      }
    }
  });

  it('configurable param min is less than max', () => {
    for (const template of HARDWARE_TEMPLATES) {
      for (const param of template.configurableParams) {
        expect(param.min).toBeLessThan(param.max);
      }
    }
  });

  it('getTemplatesByCategory returns all hardware templates', () => {
    const hardware = getTemplatesByCategory('hardware');
    expect(hardware.length).toBe(5);
  });

  it('ALL_TEMPLATES includes all hardware templates', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(ALL_TEMPLATES).toContain(template);
    }
  });
});
