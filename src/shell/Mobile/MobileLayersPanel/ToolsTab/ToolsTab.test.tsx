import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToolsTab } from './ToolsTab';
import {
  useInteractionStore,
  useLayoutStore,
  useMobileStore,
  useSelectionStore,
} from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { binId, categoryId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('ToolsTab', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ToolsTab />);
  });

  describe('counts', () => {
    function setUpLayer(cells: number, binCount: number) {
      const { layout } = useLayoutStore.getState();
      const layerId = layout.layers[0].id;
      const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
        id: binId(`bin-${i}`),
        x: gridUnits(i),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
        height: heightUnits(3),
        layerId,
        category: categoryId('default'),
        label: '',
        notes: '',
      }));
      useLayoutStore.setState({
        layout: {
          ...layout,
          drawer: { ...layout.drawer, width: gridUnits(binCount + cells), depth: gridUnits(1) },
          bins,
        },
      });
      useSelectionStore.getState().setActiveLayer(layerId);
    }

    it.each([
      ['layers.fillGaps_one', 1],
      ['layers.fillGaps_other', 2],
    ])('labels the fill button with %s for that many gaps', (label, cells) => {
      setUpLayer(cells, 0);
      render(<ToolsTab />);
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    it.each([
      ['layers.clearBins_one', 1],
      ['layers.clearBins_other', 2],
    ])('labels the clear button with %s for that many bins', (label, binCount) => {
      setUpLayer(1, binCount);
      render(<ToolsTab />);
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('arms the gap picker and closes the sheet so the grid is reachable', () => {
    useSelectionStore.getState().setActiveLayer(useLayoutStore.getState().layout.layers[0].id);
    useMobileStore.getState().setActiveMobilePanel('layers');
    render(<ToolsTab />);

    fireEvent.click(screen.getByTestId('mobile-tools-find-bins-that-fit'));

    expect(useInteractionStore.getState().gapSelectArmed).toBe(true);
    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });
});
