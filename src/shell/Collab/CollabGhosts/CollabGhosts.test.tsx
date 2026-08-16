import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CollabGhosts } from './CollabGhosts';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
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
  })),
}));

import { useOthers } from '@/liveblocks.config';

describe('CollabGhosts', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CollabGhosts />);
  });

  it('renders nothing when there are no other users', () => {
    vi.mocked(useOthers).mockReturnValue([]);
    const { container } = render(<CollabGhosts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all users are idle', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
      },
    ]);
    const { container } = render(<CollabGhosts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders drawing ghost when user is drawing', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: {
            type: 'drawing',
            start: { x: gridUnits(0), y: gridUnits(0) },
            current: { x: gridUnits(2), y: gridUnits(2) },
          },
        },
      },
    ]);
    const { container } = render(<CollabGhosts />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders dragging ghost when user is dragging bins', () => {
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

    const bins = useLayoutStore.getState().layout.bins;
    const binId = bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: {
            type: 'dragging',
            binIds: [binId],
            delta: { x: gridUnits(1), y: gridUnits(1) },
          },
        },
      },
    ]);
    const { container } = render(<CollabGhosts />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders resizing ghost when user is resizing bins', () => {
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

    const bins = useLayoutStore.getState().layout.bins;
    const binId = bins[0]?.id || 'bin1';

    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'resizing', binIds: [binId], handle: 'se' },
        },
      },
    ]);
    const { container } = render(<CollabGhosts />);
    expect(container.firstChild).not.toBeNull();
  });

  it('applies custom className', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: {
            type: 'drawing',
            start: { x: gridUnits(0), y: gridUnits(0) },
            current: { x: gridUnits(1), y: gridUnits(1) },
          },
        },
      },
    ]);
    const { container } = render(<CollabGhosts className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('is aria-hidden for accessibility', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: '#ff0000',
          interaction: {
            type: 'drawing',
            start: { x: gridUnits(0), y: gridUnits(0) },
            current: { x: gridUnits(1), y: gridUnits(1) },
          },
        },
      },
    ]);
    const { container } = render(<CollabGhosts />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

/**
 * presence.color is written by the remote client and is neither schema
 * validated by Liveblocks nor re-validated by the server. It lands in a CSS
 * `background` shorthand, which accepts a comma-separated url() layer, so a
 * crafted value needs no ';' breakout to make the victim's browser fetch an
 * attacker URL — and the site's CSP is report-only, so nothing downstream
 * blocks the request.
 */
describe('CollabGhosts — untrusted presence colour', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  function renderWithColor(color: unknown) {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: gridUnits(0.5), y: gridUnits(0.5) },
          name: 'User 1',
          color: color as string,
          interaction: {
            type: 'drawing',
            start: { x: gridUnits(0), y: gridUnits(0) },
            current: { x: gridUnits(2), y: gridUnits(2) },
          },
        },
      },
    ]);
    return render(<CollabGhosts />);
  }

  it('never emits a url() from an injected colour', () => {
    const { container } = renderWithColor('red),url(https://evil.example/x)/*');
    expect(container.innerHTML).not.toContain('url(');
    expect(container.innerHTML).not.toContain('evil.example');
  });

  it('still renders the ghost, using the fallback colour', () => {
    const { container } = renderWithColor('red),url(https://evil.example/x)/*');
    expect(container.firstChild).not.toBeNull();
  });

  it('leaves a legitimate colour intact', () => {
    const { container } = renderWithColor('#3B82F6');
    expect(container.innerHTML.toLowerCase()).toContain('#3b82f6');
  });

  it('survives a non-string colour', () => {
    const { container } = renderWithColor(undefined);
    expect(container.firstChild).not.toBeNull();
  });
});
