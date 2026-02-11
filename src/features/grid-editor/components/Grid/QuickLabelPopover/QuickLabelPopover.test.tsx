import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { QuickLabelPopover } from './QuickLabelPopover';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { createDefaultLayout } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock mutations
vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({
    updateBin: vi.fn(),
  }),
}));

// Mock analytics
vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackLabel: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({
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
    const binId = 'test-bin-1';

    // Create a mock bin element in the DOM
    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', binId);
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
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: 'Test Label',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: binId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Test Label');

    document.body.removeChild(binElement);
  });

  it('focuses and selects input on mount', async () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';

    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', binId);
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
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: 'Test',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: binId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox');

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    document.body.removeChild(binElement);
  });

  it('updates value when input changes', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'test-bin-1';

    const binElement = document.createElement('div');
    binElement.setAttribute('data-bin-id', binId);
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
            id: binId,
            x: 2,
            y: 2,
            width: 2,
            depth: 2,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
            label: 'Old',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: binId });

    const { getByRole } = render(<QuickLabelPopover />);
    const input = getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'New Label' } });
    expect(input.value).toBe('New Label');

    document.body.removeChild(binElement);
  });

  it('returns null when bin element not found in DOM', () => {
    const defaultLayout = createDefaultLayout();
    const binId = 'nonexistent-bin';

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
            label: 'Test',
            notes: '',
          },
        ],
      },
    });
    useSelectionStore.setState({ quickLabelBinId: binId });

    const { container } = render(<QuickLabelPopover />);
    expect(container.textContent).toBe('');
  });
});
