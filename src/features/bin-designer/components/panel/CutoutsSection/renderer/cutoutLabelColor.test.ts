import { describe, it, expect } from 'vitest';
import { cutoutLabelColor } from './cutoutLabelColor';

describe('cutoutLabelColor', () => {
  it('uses dark text over a light filament color', () => {
    // White filament → light cut floor → dark text stays readable. This is the
    // regression: the label used to be white and vanished here.
    expect(cutoutLabelColor('#ffffff')).toBe('#000000');
    expect(cutoutLabelColor('#e8e4d8')).toBe('#000000');
  });

  it('uses white text over a dark filament color', () => {
    expect(cutoutLabelColor('#000000')).toBe('#ffffff');
    expect(cutoutLabelColor('#1a1a2e')).toBe('#ffffff');
  });

  it('accounts for the cut-floor darkening, not the raw bin color', () => {
    // A mid-tone bin color darkens to ~0.7× before the label sits on it, so a
    // color that looks borderline-light still resolves to white text.
    expect(cutoutLabelColor('#8a8a8a')).toBe('#ffffff');
  });
});
