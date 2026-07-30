import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BinContextMenuWrapper } from './BinContextMenuWrapper';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';

vi.mock('../BinContextMenu', () => ({
  BinContextMenu: () => <div data-testid="bin-context-menu" />,
}));

vi.mock('../MultiBinContextMenu', () => ({
  MultiBinContextMenu: () => <div data-testid="multi-bin-context-menu" />,
}));

describe('BinContextMenuWrapper', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const activeLayerId = layout.layers[0]?.id ?? layerId('layer1');
    addBin({
      layerId: activeLayerId,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: layout.categories[0]?.id ?? categoryId('cat1'),
      label: '',
      notes: '',
    });
    const firstBinId = useLayoutStore.getState().layout.bins[0]?.id ?? binId('bin1');

    const onClose = vi.fn();
    render(
      <BinContextMenuWrapper binIds={[firstBinId]} position={{ x: 0, y: 0 }} onClose={onClose} />
    );
  });

  it('returns null when binIds is empty', () => {
    const onClose = vi.fn();
    const { container } = render(
      <BinContextMenuWrapper binIds={[]} position={{ x: 0, y: 0 }} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });
});
