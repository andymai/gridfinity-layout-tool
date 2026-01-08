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
});
