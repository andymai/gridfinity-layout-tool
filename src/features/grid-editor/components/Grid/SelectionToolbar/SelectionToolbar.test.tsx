import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from './SelectionToolbar';
import { binId, categoryId, layerId } from '@/core/types';
import type { Category, Layer } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
}));

// Mock ConfirmDialog to avoid portal complexity in tests
vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <button data-testid="confirm-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

const selectedBinIds = [binId('a'), binId('b'), binId('c')];

const mockCategories: Category[] = [
  { id: categoryId('cat1'), name: 'General', color: '#3b82f6' },
  { id: categoryId('cat2'), name: 'Tools', color: '#ef4444' },
];

const mockLayers: Layer[] = [{ id: layerId('layer2'), name: 'Layer 2', height: 3 }];

const defaultProps = {
  selectedBinIds,
  onAlign: vi.fn(),
  onSetCategory: vi.fn(),
  onRotateAll: vi.fn(),
  onMatchHeight: vi.fn(),
  onMoveToLayer: vi.fn(),
  onMoveToStash: vi.fn(),
  onDeleteAll: vi.fn(),
  categories: mockCategories,
  otherLayers: mockLayers,
};

describe('SelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const id of selectedBinIds) {
      const el = document.createElement('div');
      el.setAttribute('data-bin-id', id);
      el.getBoundingClientRect = () => ({
        top: 100,
        bottom: 150,
        left: 200,
        right: 300,
        width: 100,
        height: 50,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      });
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    for (const el of document.querySelectorAll('[data-bin-id]')) el.remove();
  });

  it('renders toolbar with bin count', () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders 4 alignment buttons', () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByLabelText('commandPalette.alignLeft')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignTop')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignBottom')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignRight')).toBeInTheDocument();
  });

  it('renders category color dots', () => {
    render(<SelectionToolbar {...defaultProps} />);
    const catButtons = screen.getAllByLabelText(/selectionToolbar\.setCategory/);
    expect(catButtons).toHaveLength(2);
  });

  it('calls onSetCategory when category dot clicked', () => {
    render(<SelectionToolbar {...defaultProps} />);
    const catButtons = screen.getAllByLabelText(/selectionToolbar\.setCategory/);
    fireEvent.click(catButtons[1]);
    expect(defaultProps.onSetCategory).toHaveBeenCalledWith(categoryId('cat2'));
  });

  it('calls onRotateAll when rotate button clicked', () => {
    render(<SelectionToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('selectionToolbar.rotateAll'));
    expect(defaultProps.onRotateAll).toHaveBeenCalled();
  });

  it('calls onMatchHeight when height button clicked', () => {
    render(<SelectionToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('selectionToolbar.matchHeight'));
    expect(defaultProps.onMatchHeight).toHaveBeenCalled();
  });

  it('renders layer select with other layers', () => {
    render(<SelectionToolbar {...defaultProps} />);
    const select = screen.getByLabelText('selectionToolbar.moveToLayer');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
  });

  it('calls onMoveToLayer when layer selected', () => {
    render(<SelectionToolbar {...defaultProps} />);
    const select = screen.getByLabelText('selectionToolbar.moveToLayer');
    fireEvent.change(select, { target: { value: layerId('layer2') } });
    expect(defaultProps.onMoveToLayer).toHaveBeenCalledWith(layerId('layer2'));
  });

  it('calls onMoveToStash when stash button clicked', () => {
    render(<SelectionToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('selectionToolbar.moveToStash'));
    expect(defaultProps.onMoveToStash).toHaveBeenCalled();
  });

  it('shows confirm dialog on delete click, then calls onDeleteAll on confirm', () => {
    render(<SelectionToolbar {...defaultProps} />);

    // Click delete button
    fireEvent.click(screen.getByLabelText('selectionToolbar.deleteAll'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(screen.getByTestId('confirm-btn'));
    expect(defaultProps.onDeleteAll).toHaveBeenCalled();
  });

  it('hides confirm dialog on cancel', () => {
    render(<SelectionToolbar {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('selectionToolbar.deleteAll'));
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
