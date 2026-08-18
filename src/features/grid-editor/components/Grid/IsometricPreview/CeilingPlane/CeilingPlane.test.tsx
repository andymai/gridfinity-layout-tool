import { describe, it, expect, vi } from 'vitest';
import { CeilingPlane } from './CeilingPlane';

vi.mock('@react-three/drei', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({ labelColor: '#ffffff' }),
}));

/**
 * R3F elements are not DOM, so assert the props the component computes rather
 * than a rendered tree: the Z it puts the plane at is the whole contract.
 */
function planeZ(ceilingMm: number, gridUnitMm: number): number {
  const el = CeilingPlane({
    ceilingMm,
    drawerWidth: 4,
    scaledDepth: 3,
    gridUnitMm,
    fits: true,
  }) as unknown as { props: { position: [number, number, number] } };
  return el.props.position[2];
}

describe('CeilingPlane', () => {
  // The scene's X/Y unit is one grid unit, so mm convert through gridUnitMm.
  // Dividing by heightUnitMm instead would put a 55mm ceiling at 7.86 units
  // instead of 1.31 and float it far above the drawer.
  it('places the plane by dividing mm by the grid unit', () => {
    expect(planeZ(55, 42)).toBeCloseTo(55 / 42, 6);
    expect(planeZ(84, 42)).toBeCloseTo(2, 6);
  });

  it('tracks a non-standard grid unit', () => {
    expect(planeZ(55, 21)).toBeCloseTo(55 / 21, 6);
  });

  it('centres the plane on the drawer footprint', () => {
    const el = CeilingPlane({
      ceilingMm: 55,
      drawerWidth: 4,
      scaledDepth: 3,
      gridUnitMm: 42,
      fits: false,
    }) as unknown as { props: { position: [number, number, number] } };
    expect(el.props.position[0]).toBe(2);
    expect(el.props.position[1]).toBe(1.5);
  });
});
