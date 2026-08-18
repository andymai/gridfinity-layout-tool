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

interface RenderedGroup {
  props: {
    position: [number, number, number];
    children: [
      { props: { children: [{ props: { args: [number, number] } }, unknown] } },
      { props: { position: [number, number, number]; scale: [number, number, number] } },
    ];
  };
}

function render(overrides: Partial<Parameters<typeof CeilingPlane>[0]> = {}): RenderedGroup {
  return CeilingPlane({
    ceilingMm: 55,
    drawerWidth: 4,
    drawerDepth: 3,
    depthScale: 1,
    gridUnitMm: 42,
    fits: true,
    ...overrides,
  });
}

describe('CeilingPlane', () => {
  // The scene's X/Y unit is one grid unit, so mm convert through gridUnitMm.
  // Dividing by heightUnitMm instead would put a 55mm ceiling at 7.86 units
  // instead of 1.31 and float it far above the drawer.
  it('places the plane by dividing mm by the grid unit', () => {
    expect(render({ ceilingMm: 55 }).props.position[2]).toBeCloseTo(55 / 42, 6);
    expect(render({ ceilingMm: 84 }).props.position[2]).toBeCloseTo(2, 6);
  });

  it('tracks a non-standard grid unit', () => {
    expect(render({ gridUnitMm: 21 }).props.position[2]).toBeCloseTo(55 / 21, 6);
  });

  it('centres the plane on the drawer footprint', () => {
    const el = render({ fits: false });
    expect(el.props.position[0]).toBe(2);
    expect(el.props.position[1]).toBe(1.5);
  });

  // The component renders inside the scene's depth-scaled group, which applies
  // the non-square factor. The mesh must therefore use the RAW depth — a
  // pre-scaled value would be squashed a second time — while the label
  // counter-scales so its glyphs keep their aspect.
  it('keeps the raw depth on the mesh under a non-square grid', () => {
    const el = render({ depthScale: 0.5 });
    expect(el.props.position[1]).toBe(1.5);
    expect(el.props.children[0].props.children[0].props.args).toEqual([4, 3]);
  });

  it('counter-scales the label against the group depth scale', () => {
    const text = render({ depthScale: 0.5 }).props.children[1];
    expect(text.props.scale).toEqual([1, 2, 1]);
    // World-space margin above the plane edge stays 0.35 units after the
    // group scale is applied: (1.5 + 0.35/0.5) * 0.5 − 1.5 * 0.5 = 0.35.
    expect(text.props.position[1]).toBeCloseTo(1.5 + 0.7, 6);
  });
});
