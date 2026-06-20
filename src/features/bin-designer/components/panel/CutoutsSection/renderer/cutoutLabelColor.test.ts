import { describe, it, expect } from 'vitest';
import { cutoutLabelColors } from './cutoutLabelColor';

describe('cutoutLabelColors', () => {
  it('uses dark text over a light filament color', () => {
    // White filament → light cut floor → dark text stays readable. This is the
    // regression: the label used to be white and vanished here.
    expect(cutoutLabelColors('#ffffff').fill).toBe('#000000');
    expect(cutoutLabelColors('#e8e4d8').fill).toBe('#000000');
  });

  it('uses white text over a dark filament color', () => {
    expect(cutoutLabelColors('#000000').fill).toBe('#ffffff');
    expect(cutoutLabelColors('#1a1a2e').fill).toBe('#ffffff');
  });

  it('accounts for the cut-floor darkening, not the raw bin color', () => {
    // A mid-tone bin color darkens to ~0.7× before the label sits on it, so a
    // color that looks borderline-light still resolves to white text.
    expect(cutoutLabelColors('#8a8a8a').fill).toBe('#ffffff');
  });

  it('returns the inverse of the fill as the outline halo', () => {
    expect(cutoutLabelColors('#ffffff').outline).toBe('#ffffff');
    expect(cutoutLabelColors('#000000').outline).toBe('#000000');
  });
});
