import { describe, expect, it } from 'vitest';
import { catchSection, lipSection } from './slideLidCatch';

describe('lipSection', () => {
  it('spans the lip from its support to its peak', () => {
    const section = lipSection(0, 'sharp');
    const zs = section.map(([, z]) => z);
    expect(Math.max(...zs)).toBeCloseTo(4.4, 9);
    // Down to the top of the support; the catch runs it on from there.
    expect(Math.min(...zs)).toBeCloseTo(-1.2, 9);
    expect(Math.max(...section.map(([u]) => u))).toBeCloseTo(2.6, 9);
  });

  it('never reaches outside the outer face, whatever the tip', () => {
    for (const tip of ['sharp', 'round', 'chamfer', 'flat'] as const) {
      expect(Math.min(...lipSection(0, tip).map(([u]) => u)), tip).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});

describe('catchSection', () => {
  it('stays a valid outline for a bar as deep as the lip', () => {
    const section = catchSection(0, 3, -5, 'sharp');
    for (let k = 0; k < section.length; k++) {
      const [a, b] = [section[k], section[(k + 1) % section.length]];
      expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `edge ${k}`).toBeGreaterThan(0.01);
    }
  });

  it('runs the support on at 45° until it meets the bar', () => {
    const section = catchSection(0, 0.95, -5, 'sharp');
    const bar = section.find(([u, z]) => Math.abs(u - 0.95) < 1e-9 && z > -5);
    // The support passes 2.6 in at −1.2, so at 0.95 in it is 1.65 lower.
    expect(bar?.[1]).toBeCloseTo(-1.2 - 1.65, 9);
  });
});
