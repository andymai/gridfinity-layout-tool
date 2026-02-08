import { describe, it, expect } from 'vitest';
import type { Cutout, CutoutConfig } from './index';

describe('Cutout interface', () => {
  it('accepts required properties without topOffset', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 20,
      depth: 15,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
    expect(cutout.id).toBe('test-1');
    expect(cutout.cutDepth).toBe(5);
  });

  it('accepts circle shape', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'circle',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
    expect(cutout.shape).toBe('circle');
  });
});

describe('CutoutConfig interface', () => {
  it('accepts topOffset property', () => {
    const config: CutoutConfig = {
      topOffset: 3,
    };
    expect(config.topOffset).toBe(3);
  });

  it('topOffset can be zero', () => {
    const config: CutoutConfig = {
      topOffset: 0,
    };
    expect(config.topOffset).toBe(0);
  });
});
