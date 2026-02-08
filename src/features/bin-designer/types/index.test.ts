import { describe, it, expect } from 'vitest';
import type { Cutout } from './index';

describe('Cutout interface', () => {
  it('accepts topOffset property', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 20,
      depth: 15,
      cutDepth: 5,
      topOffset: 3,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
    expect(cutout.topOffset).toBe(3);
  });

  it('topOffset can be zero', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'circle',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      cutDepth: 5,
      topOffset: 0,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
    expect(cutout.topOffset).toBe(0);
  });
});
