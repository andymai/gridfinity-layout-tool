import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BinListModal } from '../../components/modals/BinListModal';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';

// Mock matchMedia for useResponsive hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width: 767px'), // Simulate mobile
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('BinListModal', () => {
  beforeEach(() => {
    // Set up layout store with some bins
    const layout = createDefaultLayout();
    layout.bins = [
      {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layout.layers[0].id,
        category: layout.categories[0].id,
      },
    ];
    useLayoutStore.setState({ layout, activeLayoutId: 'test-layout' });

    // Set up UI store
    useUIStore.setState({
      selectedBinIds: [],
      liveMessage: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <BinListModal isOpen={false} onClose={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders when isOpen is true', () => {
      render(<BinListModal isOpen={true} onClose={() => {}} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Bin List')).toBeInTheDocument();
    });

    it('renders with proper accessibility attributes', () => {
      render(<BinListModal isOpen={true} onClose={() => {}} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'bin-list-modal-title');
    });
  });

  describe('portal rendering for mobile', () => {
    it('renders modal directly to document.body via portal', () => {
      // This test verifies that the modal is portaled to escape
      // any parent containing block (like BottomSheet with transform)
      render(<BinListModal isOpen={true} onClose={() => {}} />);

      // The modal should be a direct child of document.body
      const dialog = screen.getByRole('dialog');
      const modalContainer = dialog.closest('.fixed.inset-0');

      // Verify the modal backdrop is rendered at the body level
      // (not nested inside another component that could have transform)
      expect(modalContainer?.parentElement).toBe(document.body);
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<BinListModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close bin list');
      act(() => {
        fireEvent.click(closeButton);
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed with no selection', () => {
      const onClose = vi.fn();
      render(<BinListModal isOpen={true} onClose={onClose} />);

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('clears selection instead of closing when Escape is pressed with selection', async () => {
      const onClose = vi.fn();
      render(<BinListModal isOpen={true} onClose={onClose} />);

      // Select a row first - click on a checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is "select all", second is the row checkbox
      const rowCheckbox = checkboxes[1];

      act(() => {
        fireEvent.click(rowCheckbox);
      });

      // Now press Escape - should clear selection, not close
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      // Modal should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      // Press Escape again - now it should close
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    it('focuses close button on open', async () => {
      render(<BinListModal isOpen={true} onClose={() => {}} />);

      // Wait for focus to be set
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(screen.getByLabelText('Close bin list'));
      });
    });
  });
});

describe('BinListModal table checkboxes', () => {
  beforeEach(() => {
    const layout = createDefaultLayout();
    layout.bins = [
      {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layout.layers[0].id,
        category: layout.categories[0].id,
      },
    ];
    useLayoutStore.setState({ layout, activeLayoutId: 'test-layout' });
    useUIStore.setState({ selectedBinIds: [], liveMessage: null });
  });

  it('renders checkboxes in the table', () => {
    render(<BinListModal isOpen={true} onClose={() => {}} />);

    const checkboxes = screen.getAllByRole('checkbox');
    // Should have at least 2: select-all header + row checkbox
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('table checkboxes have compact-checkbox class for proper mobile sizing', () => {
    render(<BinListModal isOpen={true} onClose={() => {}} />);

    // Find checkboxes within the table
    const table = screen.getByRole('table');
    const tableCheckboxes = table.querySelectorAll('input[type="checkbox"]');

    // Each table checkbox should have the compact class to override mobile touch target
    tableCheckboxes.forEach((checkbox) => {
      expect(checkbox).toHaveClass('compact-checkbox');
    });
  });
});
