import { describe, expect, it } from 'vitest';
import { dimmedBinColor } from './dimmedBinColor';

describe('dimmedBinColor', () => {
  it('brightens every channel toward the board colour', () => {
    // 0x80 = 128 -> 128 * 1.35 = 172.8 -> 173 = 0xad
    expect(dimmedBinColor('#808080')).toBe('#adadad');
  });

  it('clamps rather than wrapping past white', () => {
    expect(dimmedBinColor('#ffffff')).toBe('#ffffff');
    expect(dimmedBinColor('#f0f0f0')).toBe('#ffffff');
  });

  it('expands three-digit hex', () => {
    expect(dimmedBinColor('#888')).toBe(dimmedBinColor('#888888'));
  });

  it('leaves black alone — there is nothing to fade toward', () => {
    expect(dimmedBinColor('#000000')).toBe('#000000');
  });

  it('returns anything it cannot parse untouched', () => {
    expect(dimmedBinColor('rebeccapurple')).toBe('rebeccapurple');
    expect(dimmedBinColor('#12345')).toBe('#12345');
  });
});
