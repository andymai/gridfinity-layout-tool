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
});
