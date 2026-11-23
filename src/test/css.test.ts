// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cssValue } from './css';

describe('cssValue', () => {
  it('returns what an element stores for the same value', () => {
    const el = document.createElement('div');
    el.style.transform = 'translate3d(0, -5px, 0)';
    el.style.color = '#3B82F6';
    expect(cssValue('transform', 'translate3d(0, -5px, 0)')).toBe(el.style.transform);
    expect(cssValue('color', '#3B82F6')).toBe(el.style.color);
  });

  it('is empty for a value the property does not accept', () => {
    expect(cssValue('color', 'not-a-colour')).toBe('');
  });
});
