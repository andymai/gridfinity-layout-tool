import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { DrawerOutline } from '@/core/types';

vi.mock('@react-three/drei', () => ({
  Text: vi.fn(() => null),
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({
    labelColor: '#ffffff',
  }),
}));

const { DimensionLabels } = await import('./DimensionLabels');
const { Text } = await import('@react-three/drei');

const U = 42;

/** The reporter's drawer: 931 × 327mm of material over a 21 × 7 lattice. */
const OVERSIZE: DrawerOutline = {
  vertices: [
    { x: -24.5, y: -16.5 },
    { x: 906.5, y: -16.5 },
    { x: 906.5, y: 310.5 },
    { x: -24.5, y: 310.5 },
  ],
};

function labels(props: Partial<Parameters<typeof DimensionLabels>[0]> = {}): string[] {
  render(
    <DimensionLabels
      width={21}
      depth={7}
      gridUnitMm={U}
      gridUnitMmY={U}
      paddingLeft={0}
      paddingRight={0}
      paddingFront={0}
      paddingBack={0}
      {...props}
    />
  );
  return vi
    .mocked(Text)
    .mock.calls.map(([p]) => (typeof p.children === 'string' ? p.children : ''));
}

describe('DimensionLabels', () => {
  beforeEach(() => {
    vi.mocked(Text).mockClear();
  });

  it('measures the padded grid extent on a plain rectangle', () => {
    expect(labels({ paddingLeft: 5, paddingRight: 7 })).toEqual(['894mm', '294mm']);
  });

  //. The generator widens its slab by the frame overhang and intersects it
  // with the shape, so the shape's own span is the plate. Measuring the lattice
  // annotated a 931 × 327mm plate as 882 × 294mm.
  it('measures a perimeter that reaches past the grid', () => {
    expect(labels({ outline: OVERSIZE })).toEqual(['931mm', '327mm']);
  });

  it('measures a perimeter that falls short of the grid', () => {
    const inset: DrawerOutline = {
      vertices: [
        { x: 21, y: 21 },
        { x: 21 * U - 21, y: 21 },
        { x: 21 * U - 21, y: 7 * U - 21 },
        { x: 21, y: 7 * U - 21 },
      ],
    };
    expect(labels({ outline: inset })).toEqual(['840mm', '252mm']);
  });

  it('centres the width annotation on the material, not the lattice', () => {
    render(
      <DimensionLabels
        width={21}
        depth={7}
        gridUnitMm={U}
        gridUnitMmY={U}
        paddingLeft={0}
        paddingRight={0}
        paddingFront={0}
        paddingBack={0}
        outline={OVERSIZE}
      />
    );
    const position = vi.mocked(Text).mock.calls[0][0].position;
    // The shape straddles the lattice evenly, so its midpoint stays at origin.
    expect(Array.isArray(position) ? position[0] : undefined).toBeCloseTo(0, 9);
  });
});
