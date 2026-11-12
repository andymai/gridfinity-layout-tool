import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LayersTab } from './LayersTab';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { binId, categoryId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';

vi.mock('@/features/layers', () => ({
  LayersPanel: () => <div data-testid="layers-panel" />,
}));

describe('LayersTab', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LayersTab />);
  });

  it.each([
    ['1 bin', 1],
    ['2 bins', 2],
  ])('reads "%s" for that many bins on the layer', (label, count) => {
    const { layout } = useLayoutStore.getState();
    const bins: Bin[] = Array.from({ length: count }, (_, i) => ({
      id: binId(`bin-${i}`),
      x: gridUnits(i),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      layerId: layout.layers[0].id,
      category: categoryId('default'),
      label: '',
      notes: '',
    }));
    useLayoutStore.setState({ layout: { ...layout, bins } });

    render(<LayersTab />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the tallest stack meter even with one layer', () => {
    render(<LayersTab />);
    expect(screen.getByTestId('tallest-stack-meter')).toBeInTheDocument();
  });
});
