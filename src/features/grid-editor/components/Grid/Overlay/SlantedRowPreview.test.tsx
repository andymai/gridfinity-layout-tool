import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { createTestLayout } from '@/test/testUtils';
import { gridUnits } from '@/core/types';
import type { Coord } from '@/core/types';
import { SlantedRowPreview } from './SlantedRowPreview';

const at = (x: number, y: number): Coord => ({ x: gridUnits(x), y: gridUnits(y) });

const place = {
  left: (x: number) => x * 10,
  top: (y: number, depth: number) => 100 - (y + depth) * 10,
  px: (units: number) => units * 10,
  pxY: (units: number) => units * 10,
};

beforeEach(() => {
  useLayoutStore.setState({ layout: createTestLayout() });
});

describe('SlantedRowPreview', () => {
  it('shows the bins a drag would place and hatches their support', () => {
    render(
      <SlantedRowPreview
        start={at(0, 0)}
        current={at(3, 4)}
        paintSize={{ width: 2, depth: 1 }}
        slant={{ angleDeg: 45, side: 'back' }}
        minUnit={1}
        place={place}
      />
    );
    expect(screen.getAllByTestId('slanted-row-bin')).toHaveLength(6);
    const supports = screen.getAllByTestId('slanted-row-support');
    expect(supports).toHaveLength(2);
    expect(supports[0].style.height).toBe('20px');
  });

  it('shows nothing where no row fits', () => {
    const { container } = render(
      <SlantedRowPreview
        start={at(0, 0)}
        current={at(0, 0)}
        paintSize={{ width: 9, depth: 9 }}
        slant={{ angleDeg: 45, side: 'back' }}
        minUnit={1}
        place={place}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
