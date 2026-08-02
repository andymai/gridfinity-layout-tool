// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { hasLocalDesigns } from './hasLocalDesigns';

describe('hasLocalDesigns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is false for a visitor who never used the designer', () => {
    expect(hasLocalDesigns()).toBe(false);
  });

  it('is true once the designer has recorded an active design', () => {
    localStorage.setItem('gridfinity-designer-active-v1', 'some-design-id');
    expect(hasLocalDesigns()).toBe(true);
  });
});
