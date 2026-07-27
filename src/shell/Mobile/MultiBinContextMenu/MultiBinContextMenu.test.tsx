import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MultiBinContextMenu } from './MultiBinContextMenu';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { STAGING_ID } from '@/core/constants';

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

  it('renders without crashing', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });
    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    const onClose = vi.fn();
    render(<MultiBinContextMenu binIds={[binId]} position={{ x: 0, y: 0 }} onClose={onClose} />);
  });

  it('offers expand to fit for bins placed on the grid', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });
    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    render(<MultiBinContextMenu binIds={[binId]} position={{ x: 0, y: 0 }} onClose={vi.fn()} />);
    expect(screen.getByText('mobile.binMenu.expandToFit')).toBeInTheDocument();
  });

  it('hides expand to fit when every selected bin is stashed', () => {
    const { addBin } = useLayoutStore.getState();
    addBin({ layerId: STAGING_ID, x: 0, y: 0, width: 1, depth: 1, height: 3 });
    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    render(<MultiBinContextMenu binIds={[binId]} position={{ x: 0, y: 0 }} onClose={vi.fn()} />);
    expect(screen.queryByText('mobile.binMenu.expandToFit')).not.toBeInTheDocument();
  });
});
