import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { DrawerMargin } from './DrawerMargin';
import { useLayoutStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';
import { mm } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function setPadding(padding: Partial<StoredBaseplateParams>): void {
  const layout = createDefaultLayout();
  useLayoutStore.setState({
    layout: {
      ...layout,
      gridUnitMm: mm(42),
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: mm(6),
        magnetDepth: mm(2),
        paddingLeft: mm(0),
        paddingRight: mm(0),
        paddingFront: mm(0),
        paddingBack: mm(0),
        ...padding,
      },
    },
  });
}

describe('DrawerMargin', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({ layout: createDefaultLayout() });
  });

  it('renders nothing when no baseplate padding is configured', () => {
    const { container } = render(<DrawerMargin cellSize={32} gap={2} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when every side is zero', () => {
    setPadding({});
    const { container } = render(<DrawerMargin cellSize={32} gap={2} />);
    expect(container.firstChild).toBeNull();
  });

  it('extends per side by the padding, scaled to the grid pitch', () => {
    // gridUnitMm 42, pitch = cellSize + gap = 34px. 21mm = half a unit = 17px.
    setPadding({ paddingLeft: mm(21), paddingBack: mm(42) });
    const { getByLabelText } = render(<DrawerMargin cellSize={32} gap={2} />);
    const band = getByLabelText('grid.drawerMargin.tooltip');
    // left = -(21/42)*34 = -17; top (back) = -(42/42)*34 = -34.
    expect(band.style.left).toBe('-17px');
    expect(band.style.top).toBe('-34px');
    // Unset sides stay flush with the grid box.
    expect(band.style.right).toBe('0px');
    expect(band.style.bottom).toBe('0px');
    // Decorative only: it overhangs the axis labels on padded sides, so it must
    // never capture their clicks.
    expect(band.className).toContain('pointer-events-none');
  });

  it('maps front padding to the bottom edge and right padding to the right', () => {
    setPadding({ paddingFront: mm(42), paddingRight: mm(21) });
    const { getByLabelText } = render(<DrawerMargin cellSize={32} gap={2} />);
    const band = getByLabelText('grid.drawerMargin.tooltip');
    expect(band.style.bottom).toBe('-34px');
    expect(band.style.right).toBe('-17px');
    expect(band.style.left).toBe('0px');
    expect(band.style.top).toBe('0px');
  });

  it('clamps negative padding to zero', () => {
    setPadding({ paddingLeft: mm(-10), paddingRight: mm(21) });
    const { getByLabelText } = render(<DrawerMargin cellSize={32} gap={2} />);
    const band = getByLabelText('grid.drawerMargin.tooltip');
    expect(band.style.left).toBe('0px');
    expect(band.style.right).toBe('-17px');
  });
});

describe('shaped drawer', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders nothing when the drawer has an outline (padding is stripped)', () => {
    const layout = createDefaultLayout();
    useLayoutStore.setState({
      layout: {
        ...layout,
        gridUnitMm: mm(42),
        drawer: {
          ...layout.drawer,
          outline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 168, y: 0 },
              { x: 168, y: 84 },
              { x: 84, y: 84 },
              { x: 84, y: 168 },
              { x: 0, y: 168 },
            ],
          },
        },
        baseplateParams: {
          magnetHoles: false,
          magnetDiameter: mm(6),
          magnetDepth: mm(2),
          paddingLeft: mm(10),
          paddingRight: mm(10),
          paddingFront: mm(10),
          paddingBack: mm(10),
        },
      },
    });
    const { container } = render(<DrawerMargin cellSize={40} gap={2} />);
    expect(container.firstChild).toBeNull();
  });
});
