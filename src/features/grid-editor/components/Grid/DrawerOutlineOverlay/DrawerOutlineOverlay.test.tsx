import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { gridUnits } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));
import type { DrawerOutline } from '@/core/types';
import { DrawerOutlineOverlay } from './DrawerOutlineOverlay';

const U = 42;

const L_SHAPE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 6 * U, y: 0 },
    { x: 6 * U, y: 2 * U },
    { x: 4 * U, y: 2 * U },
    { x: 4 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

function renderOverlay() {
  return render(<DrawerOutlineOverlay cellSize={40} gap={2} />);
}

describe('DrawerOutlineOverlay', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders nothing for rectangular drawers', () => {
    renderOverlay();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the hatch and boundary for a shaped drawer', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: { ...s.layout.drawer, width: gridUnits(6), depth: gridUnits(4), outline: L_SHAPE },
      },
    }));
    const { container } = renderOverlay();
    expect(screen.getByRole('img')).toBeInTheDocument();
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    // Even-odd outside fill references the hatch pattern.
    const patternIdAttr = container.querySelector('pattern')?.getAttribute('id');
    expect(paths[0].getAttribute('fill')).toBe(`url(#${patternIdAttr})`);
    expect(paths[0].getAttribute('fill-rule')).toBe('evenodd');
    // The boundary path is stroked, not filled.
    expect(paths[1].getAttribute('fill')).toBe('none');
  });

  it('draws the padding rim and plate boundary when the baseplate has padding', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: { ...s.layout.drawer, width: gridUnits(6), depth: gridUnits(4), outline: L_SHAPE },
        baseplateParams: {
          ...s.layout.baseplateParams,
          paddingLeft: 8,
          paddingRight: 8,
          paddingFront: 8,
          paddingBack: 8,
        },
      },
    }));
    const { container } = renderOverlay();
    const paths = container.querySelectorAll('path');
    // hatch + rim + plate boundary + shape boundary.
    expect(paths).toHaveLength(4);
    // The rim is an even-odd ring between plate and shape.
    expect(paths[1].getAttribute('fill-rule')).toBe('evenodd');
    expect(paths[1].getAttribute('class')).toContain('fill-accent');
    // The plate boundary is a dashed accent stroke.
    expect(paths[2].getAttribute('stroke-dasharray')).toBe('4 3');
  });

  it('omits the rim when padding would fold the shape (dropped by the resolver)', () => {
    // A one-unit-wide top slot; 30+30mm L/R padding crosses its walls.
    const SLOT: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 6 * U, y: 0 },
        { x: 6 * U, y: 4 * U },
        { x: 3.5 * U, y: 4 * U },
        { x: 3.5 * U, y: 1 * U },
        { x: 2.5 * U, y: 1 * U },
        { x: 2.5 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: { ...s.layout.drawer, width: gridUnits(6), depth: gridUnits(4), outline: SLOT },
        baseplateParams: {
          ...s.layout.baseplateParams,
          paddingLeft: 30,
          paddingRight: 30,
        },
      },
    }));
    const { container } = renderOverlay();
    // Falls back to hatch + boundary only — no rim/plate boundary.
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });
});
