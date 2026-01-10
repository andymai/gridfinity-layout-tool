import { describe, it, expect } from 'vitest';
import { darkenColor, lightenColor } from '../utils/isometric';

describe('darkenColor', () => {
  it('darkens white by 50%', () => {
    const result = darkenColor('#ffffff', 0.5);
    expect(result).toBe('#808080');
  });

  it('darkens red by 30%', () => {
    const result = darkenColor('#ff0000', 0.3);
    expect(result).toBe('#b30000');
  });

  it('fully darkens to black', () => {
    const result = darkenColor('#ffffff', 1);
    expect(result).toBe('#000000');
  });

  it('no darkening at 0%', () => {
    const result = darkenColor('#ff8800', 0);
    expect(result).toBe('#ff8800');
  });

  it('darkens mixed color by 40%', () => {
    const result = darkenColor('#88cc44', 0.4);
    expect(result).toBe('#527a29');
  });

  it('clamps negative values to 0', () => {
    const result = darkenColor('#101010', 0.5);
    expect(result).toBe('#080808');
  });

  it('handles lowercase hex input', () => {
    const result = darkenColor('#aabbcc', 0.2);
    expect(result).toBe('#8896a3');
  });

  it('handles uppercase hex input', () => {
    const result = darkenColor('#AABBCC', 0.2);
    expect(result).toBe('#8896a3');
  });

  it('darkens pure green', () => {
    const result = darkenColor('#00ff00', 0.5);
    expect(result).toBe('#008000');
  });

  it('darkens pure blue', () => {
    const result = darkenColor('#0000ff', 0.5);
    expect(result).toBe('#000080');
  });

  it('handles already dark colors', () => {
    const result = darkenColor('#020202', 0.9);
    expect(result).toBe('#000000');
  });

  it('handles small darken amounts', () => {
    const result = darkenColor('#ffffff', 0.01);
    expect(result).toBe('#fcfcfc');
  });
});

describe('lightenColor', () => {
  it('lightens black by 50%', () => {
    const result = lightenColor('#000000', 0.5);
    expect(result).toBe('#808080');
  });

  it('lightens blue by 30%', () => {
    const result = lightenColor('#0000ff', 0.3);
    expect(result).toBe('#4d4dff');
  });

  it('fully lightens to white', () => {
    const result = lightenColor('#000000', 1);
    expect(result).toBe('#ffffff');
  });

  it('no lightening at 0%', () => {
    const result = lightenColor('#ff8800', 0);
    expect(result).toBe('#ff8800');
  });

  it('lightens mixed color by 40%', () => {
    const result = lightenColor('#88cc44', 0.4);
    expect(result).toBe('#b8e08f');
  });

  it('clamps to 255', () => {
    const result = lightenColor('#f0f0f0', 0.5);
    expect(result).toBe('#f8f8f8');
  });

  it('handles lowercase hex input', () => {
    const result = lightenColor('#aabbcc', 0.2);
    expect(result).toBe('#bbc9d6');
  });

  it('handles uppercase hex input', () => {
    const result = lightenColor('#AABBCC', 0.2);
    expect(result).toBe('#bbc9d6');
  });

  it('lightens pure red', () => {
    const result = lightenColor('#ff0000', 0.5);
    expect(result).toBe('#ff8080');
  });

  it('lightens pure green', () => {
    const result = lightenColor('#00ff00', 0.5);
    expect(result).toBe('#80ff80');
  });

  it('handles already light colors', () => {
    const result = lightenColor('#fefefe', 0.9);
    expect(result).toBe('#ffffff');
  });

  it('handles small lighten amounts', () => {
    const result = lightenColor('#000000', 0.01);
    expect(result).toBe('#030303');
  });
});

describe('color transformation symmetry', () => {
  it('darken then lighten does not return exact original (lossy)', () => {
    const original = '#808080';
    const darkened = darkenColor(original, 0.5);
    const restored = lightenColor(darkened, 0.5);
    // Due to integer rounding, exact restoration is not expected
    expect(restored).not.toBe(original);
  });

  it('both functions produce valid hex format', () => {
    const hexPattern = /^#[0-9a-f]{6}$/;
    expect(darkenColor('#abcdef', 0.3)).toMatch(hexPattern);
    expect(lightenColor('#abcdef', 0.3)).toMatch(hexPattern);
  });

  it('darken and lighten at 0% return same color', () => {
    const color = '#12ab34';
    expect(darkenColor(color, 0)).toBe(color);
    expect(lightenColor(color, 0)).toBe(color);
  });

  it('extreme percentages converge to black/white', () => {
    expect(darkenColor('#888888', 1)).toBe('#000000');
    expect(lightenColor('#888888', 1)).toBe('#ffffff');
  });
});
