import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CollabSelectionRings } from './CollabSelectionRings';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';

// Mock Liveblocks hooks
vi.mock('@/liveblocks.config', () => ({
  useOthers: vi.fn(() => []),
}));

// Mock hooks
vi.mock('@/shared/hooks', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
  })),
}));

import { useOthers } from '@/liveblocks.config';

describe('CollabSelectionRings', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CollabSelectionRings />);
  });

  it('renders nothing when there are no other users', () => {
    vi.mocked(useOthers).mockReturnValue([]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no users have selections', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [],
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).toBeNull();
  });

  it('renders selection rings when users have selected bins', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).not.toBeNull();
  });

  it('applies custom className', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    const { container } = render(<CollabSelectionRings className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('is aria-hidden for accessibility', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id || 'layer1';
    addBin({ layerId, x: 0, y: 0, width: 1, depth: 1, height: 3 });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('skips bins in staging layer', () => {
    const { addBin } = useLayoutStore.getState();
    addBin({ layerId: '__staging__', x: 0, y: 0, width: 1, depth: 1, height: 3 });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).toBeNull();
  });
});
