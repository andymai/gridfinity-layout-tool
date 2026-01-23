import { describe, it, expect } from 'vitest';
import { HARDWARE_TEMPLATES } from '../../templates/hardware';
import { ALL_TEMPLATES, getTemplatesByCategory, getTemplateById } from '../../templates';

describe('hardware templates', () => {
  it('has 18 hardware templates', () => {
    expect(HARDWARE_TEMPLATES).toHaveLength(18);
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

  it('hex nut templates use hexagon shape', () => {
    const nuts = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('nut-'));
    expect(nuts.length).toBe(5); // M3-M8
    for (const nut of nuts) {
      expect(nut.shape).toBe('hexagon');
    }
  });

  it('screw templates use circle shape', () => {
    const screws = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('screw-'));
    expect(screws.length).toBe(5); // M3-M8
    for (const screw of screws) {
      expect(screw.shape).toBe('circle');
    }
  });

  it('washer templates use circle shape', () => {
    const washers = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('washer-'));
    expect(washers.length).toBe(3); // M4, M5, M6
    for (const washer of washers) {
      expect(washer.shape).toBe('circle');
    }
  });

  it('hex key templates use hexagon shape', () => {
    const keys = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('hex-key'));
    expect(keys.length).toBe(3);
    for (const key of keys) {
      expect(key.shape).toBe('hexagon');
    }
  });

  it('bit holder templates use hexagon shape', () => {
    const bits = HARDWARE_TEMPLATES.filter((t) => t.id.startsWith('bit-'));
    expect(bits.length).toBe(2);
    for (const bit of bits) {
      expect(bit.shape).toBe('hexagon');
    }
  });

  it('M3 screw has correct clearance-adjusted dimensions', () => {
    const m3 = getTemplateById('screw-m3');
    expect(m3).toBeDefined();
    // M3 head = 5.5mm + 0.5mm clearance = 6mm
    expect(m3!.defaults.width).toBe(6);
    expect(m3!.defaults.depth).toBe(6);
    // M3 length 16mm + 0.5 clearance = 16.5
    expect(m3!.defaults.cutDepth).toBe(16.5);
  });

  it('M6 hex nut has correct across-flats dimension', () => {
    const m6 = getTemplateById('nut-m6');
    expect(m6).toBeDefined();
    // M6 nut AF = 10mm + 0.5 clearance = 10.5
    expect(m6!.defaults.width).toBe(10.5);
  });

  it('quarter-inch bit has correct dimension', () => {
    const bit = getTemplateById('bit-quarter-inch');
    expect(bit).toBeDefined();
    // 6.35mm + 0.5 clearance = 6.85
    expect(bit!.defaults.width).toBe(6.85);
  });

  it('circular templates have equal width and depth', () => {
    const circular = HARDWARE_TEMPLATES.filter((t) => t.shape === 'circle');
    for (const template of circular) {
      expect(template.defaults.width).toBe(template.defaults.depth);
    }
  });

  it('hexagon templates have equal width and depth', () => {
    const hexes = HARDWARE_TEMPLATES.filter((t) => t.shape === 'hexagon');
    for (const template of hexes) {
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
    expect(hardware.length).toBe(18);
  });

  it('ALL_TEMPLATES includes all hardware templates', () => {
    for (const template of HARDWARE_TEMPLATES) {
      expect(ALL_TEMPLATES).toContain(template);
    }
  });
});
