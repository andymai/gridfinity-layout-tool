import { describe, it, expect } from 'vitest';
import { hasShapeControls, hasFitControls, formatFitSummary } from './cutoutSectionVisibility';
import type { Cutout } from '@/features/bin-designer/types';

function c(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const labels = { clearance: 'Clearance', chamfer: 'Chamfer', none: 'No fit allowance' };

describe('hasShapeControls', () => {
  it('is true only for polygon and circle', () => {
    expect(hasShapeControls('polygon')).toBe(true);
    expect(hasShapeControls('circle')).toBe(true);
    expect(hasShapeControls('rectangle')).toBe(false);
    expect(hasShapeControls('slot')).toBe(false);
  });
});

describe('hasFitControls', () => {
  it('covers insert shapes and rectangle chamfer, excludes path', () => {
    expect(hasFitControls(c({ shape: 'circle' }))).toBe(true);
    expect(hasFitControls(c({ shape: 'rectangle' }))).toBe(true);
    expect(hasFitControls(c({ shape: 'path' }))).toBe(false);
  });
});

describe('formatFitSummary', () => {
  it('lists clearance and chamfer when both set', () => {
    const s = formatFitSummary(c({ shape: 'circle', clearance: 0.2, chamferWidth: 1 }), labels);
    expect(s).toBe('Clearance +0.2mm · Chamfer 1mm');
  });

  it('shows only the set allowance', () => {
    expect(formatFitSummary(c({ shape: 'circle', clearance: 0.3 }), labels)).toBe(
      'Clearance +0.3mm'
    );
    expect(formatFitSummary(c({ shape: 'rectangle', chamferWidth: 2 }), labels)).toBe(
      'Chamfer 2mm'
    );
  });

  it('falls back to the none label when nothing is set', () => {
    expect(formatFitSummary(c({ shape: 'circle', clearance: 0, chamferWidth: 0 }), labels)).toBe(
      'No fit allowance'
    );
  });

  it('ignores fields that do not apply to the shape', () => {
    // Rectangle has no clearance, so a stray clearance value is not summarized.
    expect(formatFitSummary(c({ shape: 'rectangle', clearance: 0.5 }), labels)).toBe(
      'No fit allowance'
    );
  });
});
