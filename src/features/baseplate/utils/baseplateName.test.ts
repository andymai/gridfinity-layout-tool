import { describe, it, expect } from 'vitest';
import { nextBaseplateName } from './baseplateName';
import type { BaseplateRef } from '@/features/baseplate/store/baseplateRegistry';

const refs = (...names: string[]): BaseplateRef[] =>
  names.map((name, i) => ({
    id: `bp-${i}` as BaseplateRef['id'],
    name,
    updatedAt: '2024-01-01',
  }));

describe('nextBaseplateName', () => {
  it('starts at 1 for an empty library', () => {
    expect(nextBaseplateName([])).toBe('Baseplate 1');
  });

  it('counts past a contiguous run', () => {
    expect(nextBaseplateName(refs('Baseplate 1', 'Baseplate 2'))).toBe('Baseplate 3');
  });

  // Deleting Baseplate 2 and creating another should reuse 2, not drift to 4.
  it('fills a gap rather than appending', () => {
    expect(nextBaseplateName(refs('Baseplate 1', 'Baseplate 3'))).toBe('Baseplate 2');
  });

  it('ignores custom names', () => {
    expect(nextBaseplateName(refs('Deep Drawer', 'Kitchen'))).toBe('Baseplate 1');
  });

  it('ignores names that only look numbered', () => {
    expect(
      nextBaseplateName(refs('Baseplate 1a', 'Baseplate', 'baseplate 1', 'My Baseplate 1'))
    ).toBe('Baseplate 1');
  });

  it('is unaffected by ordering', () => {
    expect(nextBaseplateName(refs('Baseplate 3', 'Baseplate 1', 'Baseplate 2'))).toBe(
      'Baseplate 4'
    );
  });
});
