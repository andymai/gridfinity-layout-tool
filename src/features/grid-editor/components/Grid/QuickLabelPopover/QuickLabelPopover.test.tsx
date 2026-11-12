import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { QuickLabelPopover } from './QuickLabelPopover';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { createDefaultLayout } from '@/core/constants';
import { binId, gridUnits, heightUnits } from '@/core/types';

// Mock i18n
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// Mock mutations
vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({
    updateBin: vi.fn(),
  }),
}));

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackLabel: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  markFeatureUsed: vi.fn(),
}));

describe('QuickLabelPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders nothing when quickLabelBinId is null', () => {
    useSelectionStore.setState({ quickLabelBinId: null });
    const { container } = render(<QuickLabelPopover />);
    expect(container.textContent).toBe('');
  });

  it('renders popover when quickLabelBinId is set', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');

    // Create a mock bin element in the DOM
    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', testBinId);
    binElement.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      bottom: 200,
      right: 200,
      width: 100,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    document.body.appendChild(binElement);

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
            label: 'Test Label',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: testBinId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Test Label');

    document.body.removeChild(binElement);
  });

  it('focuses and selects input on mount', async () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');

    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', testBinId);
    binElement.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      bottom: 200,
      right: 200,
      width: 100,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    document.body.appendChild(binElement);

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
            label: 'Test',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: testBinId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox');

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    document.body.removeChild(binElement);
  });

  it('updates value when input changes', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('test-bin-1');

    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', testBinId);
    binElement.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      bottom: 200,
      right: 200,
      width: 100,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    document.body.appendChild(binElement);

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
            label: 'Old',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: testBinId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'New Label' } });
    expect(input.value).toBe('New Label');

    document.body.removeChild(binElement);
  });

  describe('placement', () => {
    // jsdom's viewport is 1024 x 768.
    const POPOVER_WIDTH = 226;
    const POPOVER_HEIGHT = 120;

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(POPOVER_WIDTH);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(POPOVER_HEIGHT);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function renderOverBin(rect: { left: number; top: number; width: number; height: number }) {
      const defaultLayout = createDefaultLayout();
      const testBinId = binId('test-bin-1');
      const binElement = document.createElement('div');
      binElement.setAttribute('data-bin-id', testBinId);
      binElement.getBoundingClientRect = vi.fn(() => ({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }));
      document.body.appendChild(binElement);
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
      useSelectionStore.setState({ quickLabelBinId: testBinId });
      const { getByRole } = render(<QuickLabelPopover />);
      const popover = getByRole('textbox').closest('.animate-scale-in');
      document.body.removeChild(binElement);
      if (!(popover instanceof HTMLElement)) throw new Error('popover not found');
      return {
        centre: parseFloat(popover.style.left),
        top: parseFloat(popover.style.top),
        popover,
      };
    }

    it('centres above the bin without a transform that scale-in overrides', () => {
      const { popover, centre, top } = renderOverBin({
        left: 400,
        top: 300,
        width: 100,
        height: 100,
      });
      expect(popover).toHaveClass('-translate-x-1/2', 'w-max');
      expect(popover.style.transform).toBe('');
      expect(centre).toBe(450);
      expect(top).toBe(300 - 8 - POPOVER_HEIGHT);
    });

    it('drops below a bin with less room above than the popover needs', () => {
      const { top } = renderOverBin({ left: 400, top: 120, width: 100, height: 100 });
      expect(top).toBe(228);
    });

    it('keeps the popover inside the viewport bottom for a tall bin', () => {
      const { top } = renderOverBin({ left: 400, top: 60, width: 100, height: 620 });
      expect(top).toBe(768 - 16 - POPOVER_HEIGHT);
    });

    it('stays on screen when a tall bin leaves room on neither side', () => {
      const { top } = renderOverBin({ left: 400, top: 120, width: 100, height: 580 });
      expect(top).toBeGreaterThanOrEqual(16);
      expect(top + POPOVER_HEIGHT).toBeLessThanOrEqual(768 - 16);
    });

    it('keeps the left edge on screen for a bin at the left edge', () => {
      const { centre } = renderOverBin({ left: 30, top: 300, width: 100, height: 100 });
      expect(centre - POPOVER_WIDTH / 2).toBe(16);
    });

    it('keeps the right edge on screen for a bin at the right edge', () => {
      const { centre } = renderOverBin({ left: 960, top: 300, width: 60, height: 100 });
      expect(centre + POPOVER_WIDTH / 2).toBe(1024 - 16);
    });
  });

  it('returns null when bin element not found in DOM', () => {
    const defaultLayout = createDefaultLayout();
    const testBinId = binId('nonexistent-bin');

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
            label: 'Test',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: testBinId });

    const { container } = render(<QuickLabelPopover />);
    expect(container.textContent).toBe('');
  });
});
