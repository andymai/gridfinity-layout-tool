import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { Overlay } from './Overlay';
import { useInteractionStore, useLayoutStore, useHalfGridModeStore } from '@/core/store';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits } from '@/core/types';

// Mock i18n
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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
        start: { x: gridUnits(0), y: gridUnits(0) },
        current: { x: gridUnits(2), y: gridUnits(2) },
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders drag preview when valid', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: testBinId,
            x: gridUnits(2),
            y: gridUnits(2),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
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
        binIds: [testBinId],
        startCoord: { x: gridUnits(2), y: gridUnits(2) },
        currentCoord: { x: gridUnits(1), y: gridUnits(1) },
        valid: true,
        isOverGrid: true,
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders resize preview', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: testBinId,
            x: gridUnits(2),
            y: gridUnits(2),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
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
        binIds: [testBinId],
        handle: 'se',
        startRects: new Map([
          [
            testBinId,
            { x: gridUnits(2), y: gridUnits(2), width: gridUnits(2), depth: gridUnits(2) },
          ],
        ]),
        currentRects: new Map([
          [
            testBinId,
            { x: gridUnits(2), y: gridUnits(2), width: gridUnits(3), depth: gridUnits(3) },
          ],
        ]),
        valid: true,
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container.querySelector('[style*="border"]')).toBeTruthy();
  });

  it('renders staging drag preview', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: testBinId,
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
            layerId: STAGING_ID,
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
        binId: testBinId,
        currentCoord: { x: gridUnits(2), y: gridUnits(2) },
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
        start: { x: gridUnits(0), y: gridUnits(0) },
        current: { x: gridUnits(4), y: gridUnits(4) },
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
        start: { x: gridUnits(0), y: gridUnits(0) },
        current: { x: gridUnits(1.5), y: gridUnits(1.5) },
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container).toBeTruthy();
  });

  it('shows error indicator when drag is invalid', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');
    useLayoutStore.setState({
      layout: {
        ...defaultLayout,
        bins: [
          {
            id: testBinId,
            x: gridUnits(2),
            y: gridUnits(2),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
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
        binIds: [testBinId],
        startCoord: { x: gridUnits(2), y: gridUnits(2) },
        currentCoord: { x: gridUnits(1), y: gridUnits(1) },
        valid: false,
        isOverGrid: true,
        invalidReason: 'collision',
      },
    });
    const { container } = render(<Overlay cellSize={32} gap={2} />);
    expect(container).toBeTruthy();
  });
});
