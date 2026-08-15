import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CollabSelectionRings } from './CollabSelectionRings';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { STAGING_ID } from '@/core/constants';
import { categoryId, gridUnits, heightUnits, layerId as brandLayerId } from '@/core/types';

// Mock Liveblocks hooks
vi.mock('@/liveblocks.config', () => ({
  useOthers: vi.fn(() => []),
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
    viewportHeight: 800,
    isLandscape: true,
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
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [],
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).toBeNull();
  });

  it('renders selection rings when users have selected bins', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id ?? brandLayerId('layer1');
    addBin({
      layerId,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
    });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).not.toBeNull();
  });

  it('applies custom className', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id ?? brandLayerId('layer1');
    addBin({
      layerId,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
    });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabSelectionRings className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('is aria-hidden for accessibility', () => {
    const { addBin } = useLayoutStore.getState();
    const layerId = useLayoutStore.getState().layout.layers[0]?.id ?? brandLayerId('layer1');
    addBin({
      layerId,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
    });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('skips bins in staging layer', () => {
    const { addBin } = useLayoutStore.getState();
    addBin({
      layerId: STAGING_ID,
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
    });

    const binId = useLayoutStore.getState().layout.bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          selectedBinIds: [binId],
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabSelectionRings />);
    expect(container.firstChild).toBeNull();
  });
});
