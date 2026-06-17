import { describe, it, expect } from 'vitest';
import {
  hasShapeControls,
  hasFitControls,
  formatFitSummary,
  canArray,
} from './cutoutSectionVisibility';
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
  it('covers insert shapes, rectangle chamfer, and paths (clearance + chamfer)', () => {
    expect(hasFitControls(c({ shape: 'circle' }))).toBe(true);
    expect(hasFitControls(c({ shape: 'rectangle' }))).toBe(true);
    expect(hasFitControls(c({ shape: 'path' }))).toBe(true);
  });
});

describe('canArray', () => {
  it('allows ungrouped non-path shapes', () => {
    expect(canArray({ shape: 'circle', groupId: null })).toBe(true);
    expect(canArray({ shape: 'rectangle', groupId: null })).toBe(true);
  });
  it('excludes paths and grouped cutouts', () => {
    expect(canArray({ shape: 'path', groupId: null })).toBe(false);
    expect(canArray({ shape: 'circle', groupId: 'g1' })).toBe(false);
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

  it('clamps the chamfer to cut depth (matches the control)', () => {
    // chamfer 2mm but cutDepth 0.5 → capped at 0.3mm, like CutoutFitControls.
    expect(
      formatFitSummary(c({ shape: 'circle', clearance: 0, chamferWidth: 2, cutDepth: 0.5 }), labels)
    ).toBe('Chamfer 0.3mm');
  });
});
