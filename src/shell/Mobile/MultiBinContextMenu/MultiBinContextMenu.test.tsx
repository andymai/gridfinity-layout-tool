import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MultiBinContextMenu } from './MultiBinContextMenu';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { STAGING_ID } from '@/core/constants';
import type { BinId, LayerId } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';

vi.mock('@/shared/components/ContextMenu', () => ({
  ContextMenuContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuItem: ({ label }: { label: string }) => <div>{label}</div>,
  ContextMenuDivider: () => <div data-testid="divider" />,
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({
    deleteBin: vi.fn(),
    updateBin: vi.fn(),
    expandBinsToFit: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/useContextMenu', () => ({
  useContextMenu: () => ({ menuRef: { current: null } }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, number | string>) => {
    if (key === 'mobile.multiBinMenu.selectedBins')
      return `${String(params?.count ?? 0)} Bins Selected`;
    return key;
  },
}));

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackDeletion: vi.fn(),
    trackQuickCorrect: vi.fn(),
    trackBinsDeletion: vi.fn(),
  },
}));

describe('MultiBinContextMenu', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  function addTestBin(targetLayerId: LayerId): BinId {
    const { addBin, layout } = useLayoutStore.getState();
    addBin({
      layerId: targetLayerId,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: layout.categories[0]?.id ?? categoryId('cat1'),
      label: '',
      notes: '',
    });
    return useLayoutStore.getState().layout.bins[0]?.id ?? binId('bin1');
  }

  function activeLayerId(): LayerId {
    return useLayoutStore.getState().layout.layers[0]?.id ?? layerId('layer1');
  }

  it('renders without crashing', () => {
    const firstBinId = addTestBin(activeLayerId());

    const onClose = vi.fn();
    render(
      <MultiBinContextMenu binIds={[firstBinId]} position={{ x: 0, y: 0 }} onClose={onClose} />
    );
  });

  it('offers expand to fit for bins placed on the grid', () => {
    const firstBinId = addTestBin(activeLayerId());

    render(
      <MultiBinContextMenu binIds={[firstBinId]} position={{ x: 0, y: 0 }} onClose={vi.fn()} />
    );
    expect(screen.getByText('mobile.binMenu.expandToFit')).toBeInTheDocument();
  });

  it('hides expand to fit when every selected bin is stashed', () => {
    const firstBinId = addTestBin(STAGING_ID);

    render(
      <MultiBinContextMenu binIds={[firstBinId]} position={{ x: 0, y: 0 }} onClose={vi.fn()} />
    );
    expect(screen.queryByText('mobile.binMenu.expandToFit')).not.toBeInTheDocument();
  });
});
