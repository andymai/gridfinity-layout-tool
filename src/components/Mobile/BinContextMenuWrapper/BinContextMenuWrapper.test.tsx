import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BinContextMenuWrapper } from './BinContextMenuWrapper';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';

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
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });
    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    const onClose = vi.fn();
    render(<BinContextMenuWrapper binIds={[binId]} position={{ x: 0, y: 0 }} onClose={onClose} />);
  });

  it('returns null when binIds is empty', () => {
    const onClose = vi.fn();
    const { container } = render(
      <BinContextMenuWrapper binIds={[]} position={{ x: 0, y: 0 }} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });
});
