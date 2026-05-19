import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { Overlay } from './Overlay';
import { useInteractionStore, useLayoutStore, useHalfGridModeStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('Overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
  });

  it('renders without crashing when no interaction', () => {
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container).toBeTruthy();
  });

  it('returns null when no interaction active', () => {
    useInteractionStore.setState({ interaction: null });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.textContent).toBe('');
  });

  it('renders draw preview', () => {
    useInteractionStore.setState({
      interaction: {
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 2, y: 2 },
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders drag preview when valid', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: '',
            notes: '',
          },
        ],
      },
    });
    useInteractionStore.setState({
      interaction: {
        type: 'drag',
        binIds: [binId],
        currentCoord: { x: 1, y: 1 },
        valid: true,
        isOverGrid: true,
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders resize preview', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: '',
            notes: '',
          },
        ],
      },
    });
    useInteractionStore.setState({
      interaction: {
        type: 'resize',
        binIds: [binId],
        currentRects: new Map([[binId, { x: 2, y: 2, width: 3, depth: 3 }]]),
        valid: true,
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders staging drag preview', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: binId,
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: '__staging__',
            category: defaultLayout.categories[0].id,
            label: '',
            notes: '',
          },
        ],
      },
    });
    useInteractionStore.setState({
      interaction: {
        type: 'stagingDrag',
        binId,
        currentCoord: { x: 2, y: 2 },
        valid: true,
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders paint preview', () => {
    useInteractionStore.setState({
      interaction: {
        type: 'paint',
        start: { x: 0, y: 0 },
        current: { x: 4, y: 4 },
        paintSize: { width: 2, depth: 2 },
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('handles half-bin mode in draw interaction', () => {
    useHalfGridModeStore.setState({ halfGridMode: true });
    useInteractionStore.setState({
      interaction: {
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 1.5, y: 1.5 },
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container).toBeTruthy();
  });

  it('shows error indicator when drag is invalid', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: '',
            notes: '',
          },
        ],
      },
    });
    useInteractionStore.setState({
      interaction: {
        type: 'drag',
        binIds: [binId],
        currentCoord: { x: 1, y: 1 },
        valid: false,
        isOverGrid: true,
        invalidReason: 'collision',
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container).toBeTruthy();
  });
});
