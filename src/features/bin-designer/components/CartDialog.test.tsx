import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartDialog } from './CartDialog';
import { useCartStore } from '../store/cart';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { CartItem } from '../types';

// Mock batchExport to avoid WASM worker initialization
vi.mock('../../utils/batchExport', () => ({
  batchExport: vi.fn(),
}));

function makeCartItem(id: string, name: string = 'Test Bin'): CartItem {
  return {
    id,
    name,
    params: { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    addedAt: '2026-01-22T00:00:00.000Z',
  };
}

describe('CartDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useCartStore.setState({ items: [] });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<CartDialog open={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Export Cart')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it('shows item count badge', () => {
    useCartStore.setState({ items: [makeCartItem('a'), makeCartItem('b')] });
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders cart items with name and dimensions', () => {
    useCartStore.setState({ items: [makeCartItem('bin-1', 'My Custom Bin')] });
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.getByText('My Custom Bin')).toBeInTheDocument();
    // Default dims: 2×2×3
    expect(screen.getByText('2×2×3')).toBeInTheDocument();
  });

  it('removes item when remove button clicked', () => {
    useCartStore.setState({ items: [makeCartItem('bin-1', 'Removable Bin')] });
    render(<CartDialog open={true} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Remove Removable Bin from cart'));
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('clears all items when Clear cart clicked', () => {
    useCartStore.setState({
      items: [makeCartItem('a'), makeCartItem('b'), makeCartItem('c')],
    });
    render(<CartDialog open={true} onClose={onClose} />);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText('Clear cart'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Remove all 3 items'));
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('shows Download ZIP button when items present', () => {
    useCartStore.setState({ items: [makeCartItem('bin-1')] });
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.getByText('Download ZIP')).toBeInTheDocument();
  });

  it('does not show Download ZIP when empty', () => {
    render(<CartDialog open={true} onClose={onClose} />);
    expect(screen.queryByText('Download ZIP')).not.toBeInTheDocument();
  });

  it('shows estimate totals in footer', () => {
    useCartStore.setState({ items: [makeCartItem('bin-1')] });
    render(<CartDialog open={true} onClose={onClose} />);
    // Should show filament and time estimates
    expect(screen.getByText(/filament/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<CartDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders multiple items in order', () => {
    useCartStore.setState({
      items: [makeCartItem('bin-1', 'First Bin'), makeCartItem('bin-2', 'Second Bin')],
    });
    render(<CartDialog open={true} onClose={onClose} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByText('First Bin')).toBeInTheDocument();
    expect(screen.getByText('Second Bin')).toBeInTheDocument();
  });
});
