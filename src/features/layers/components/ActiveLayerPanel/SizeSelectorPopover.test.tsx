import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SizeSelectorPopover } from './SizeSelectorPopover';
import { createRef } from 'react';

// Mock Popover to render children inline (avoids portal issues in tests)
vi.mock('@/design-system', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Popover: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? <div data-testid="popover">{children}</div> : null,
  };
});

describe('SizeSelectorPopover', () => {
  const defaultProps = {
    anchorRef: createRef<HTMLElement>(),
    isOpen: true,
    onClose: vi.fn(),
    paintSize: null as { width: number; depth: number } | null,
    onSelectSize: vi.fn(),
    onShiftClickSize: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders squares and rectangles sections when open', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      expect(screen.getByText('Squares')).toBeInTheDocument();
      expect(screen.getByText('Rectangles')).toBeInTheDocument();
    });

    it('renders all square sizes', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      expect(screen.getByText('1×1')).toBeInTheDocument();
      expect(screen.getByText('2×2')).toBeInTheDocument();
      expect(screen.getByText('3×3')).toBeInTheDocument();
      expect(screen.getByText('4×4')).toBeInTheDocument();
      expect(screen.getByText('5×5')).toBeInTheDocument();
      expect(screen.getByText('6×6')).toBeInTheDocument();
    });

    it('renders rectangle sizes', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      expect(screen.getByText('1×2')).toBeInTheDocument();
      expect(screen.getByText('2×3')).toBeInTheDocument();
      expect(screen.getByText('5×6')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<SizeSelectorPopover {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Squares')).not.toBeInTheDocument();
    });
  });

  describe('size selection', () => {
    it('calls onSelectSize on normal click', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      fireEvent.click(screen.getByText('2×2'));

      expect(defaultProps.onSelectSize).toHaveBeenCalledWith(2, 2);
    });

    it('calls onClose on normal click', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      fireEvent.click(screen.getByText('3×3'));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onShiftClickSize on shift+click', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      const button = screen.getByText('2×2').closest('button')!;
      fireEvent.click(button, { shiftKey: true });

      expect(defaultProps.onShiftClickSize).toHaveBeenCalledWith(2, 2);
    });

    it('does not close on shift+click', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      const button = screen.getByText('2×2').closest('button')!;
      fireEvent.click(button, { shiftKey: true });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('active state', () => {
    it('highlights active paint size', () => {
      render(<SizeSelectorPopover {...defaultProps} paintSize={{ width: 3, depth: 3 }} />);

      const button = screen.getByText('3×3').closest('button')!;
      expect(button.className).toContain('bg-accent/20');
    });
  });

  describe('rotation toggle', () => {
    it('shows wide label by default', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      expect(screen.getByText('Wide')).toBeInTheDocument();
    });

    it('toggles to tall on click', () => {
      render(<SizeSelectorPopover {...defaultProps} />);

      fireEvent.click(screen.getByText('Wide'));

      expect(screen.getByText('Tall')).toBeInTheDocument();
    });
  });
});
