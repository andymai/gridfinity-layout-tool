import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutGridItem } from './LayoutGridItem';
import type { LayoutEntry } from '@/core/types';

// Mock components
vi.mock('@/shell/LayoutThumbnail', () => ({
  LayoutThumbnail: ({ preview }: { preview: unknown }) => (
    <div data-testid="layout-thumbnail">Thumbnail: {JSON.stringify(preview)}</div>
  ),
}));

vi.mock('../LayoutActions', () => ({
  LayoutActions: () => <div data-testid="layout-actions">Actions</div>,
}));

vi.mock('../useInlineEdit', () => ({
  useInlineEdit: ({
    initialValue,
    onSave: _onSave,
  }: {
    initialValue: string;
    onSave: (value: string) => void;
  }) => ({
    isEditing: false,
    editingValue: initialValue,
    inputRef: { current: null },
    startEditing: vi.fn(),
    handleChange: vi.fn(),
    handleFinish: vi.fn(),
    handleKeyDown: vi.fn(),
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
  useFormatting: () => ({
    formatRelativeDate: (timestamp: number) => `${timestamp} ago`,
  }),
}));

describe('LayoutGridItem', () => {
  const mockEntry: LayoutEntry = {
    id: 'layout-1',
    name: 'Test Layout',
    createdAt: 1000000,
    modifiedAt: 2000000,
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 5,
      layerCount: 2,
      binMap: [],
    },
  };

  const mockCallbacks = {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onCopyLink: vi.fn(),
    onDownload: vi.fn(),
    onFocus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders layout name', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Test Layout')).toBeInTheDocument();
  });

  it('displays bin count and drawer dimensions', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText(/5.*layouts.bins/)).toBeInTheDocument();
    expect(screen.getByText(/10×8/)).toBeInTheDocument();
  });

  it('shows active badge when layout is active', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('layouts.active')).toBeInTheDocument();
  });

  it('does not show active badge when layout is not active', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.queryByText('layouts.active')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    const card = screen.getByRole('option');
    fireEvent.click(card);

    expect(mockCallbacks.onSelect).toHaveBeenCalled();
  });

  it('calls onSelect when Enter key is pressed', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={true}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    const card = screen.getByRole('option');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(mockCallbacks.onSelect).toHaveBeenCalled();
  });

  it('renders thumbnail', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByTestId('layout-thumbnail')).toBeInTheDocument();
  });

  it('renders layout actions', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByTestId('layout-actions')).toBeInTheDocument();
  });

  it('shows forked from info when present', () => {
    const forkedEntry = {
      ...mockEntry,
      forkedFrom: {
        id: 'original-id',
        name: 'Original Layout',
      },
    };

    render(
      <LayoutGridItem
        entry={forkedEntry}
        isActive={false}
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText(/layouts.forkedFromName/)).toBeInTheDocument();
  });

  it('has correct aria attributes', () => {
    render(
      <LayoutGridItem
        entry={mockEntry}
        isActive
        isFocused
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    const card = screen.getByRole('option');
    expect(card).toHaveAttribute('aria-selected', 'true');
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('applies border highlight when active', () => {
    const { container } = render(
      <LayoutGridItem
        entry={mockEntry}
        isActive
        isFocused={false}
        isOnlyLayout={false}
        {...mockCallbacks}
      />
    );

    const card = container.querySelector('[role="option"]');
    expect(card).toHaveClass('border-accent');
  });
});
