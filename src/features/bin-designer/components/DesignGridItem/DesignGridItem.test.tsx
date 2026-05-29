import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { DesignGridItem } from './DesignGridItem';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { SavedDesign } from '../../types';

// Mock DesignActions component
vi.mock('../DesignActions', () => ({
  DesignActions: () => <div data-testid="design-actions">Actions</div>,
}));

// Mock BinDesignThumbnail component
vi.mock('../BinDesignThumbnail', () => ({
  BinDesignThumbnail: () => <div data-testid="bin-thumbnail">Thumbnail</div>,
}));

describe('DesignGridItem', () => {
  const mockDesign: SavedDesign = {
    id: 'test-id',
    name: 'Test Design',
    params: DEFAULT_BIN_PARAMS,
    thumbnail: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const defaultProps = {
    design: mockDesign,
    isActive: false,
    isFocused: false,
    onSelect: vi.fn(),
    onDownloadJSON: vi.fn(),
    onRename: vi.fn(),
    onEditTags: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onFocus: vi.fn(),
    itemRef: vi.fn(),
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DesignGridItem {...defaultProps} />);
    expect(screen.getByText('Test Design')).toBeInTheDocument();
  });

  it('shows design name', () => {
    render(<DesignGridItem {...defaultProps} />);
    expect(screen.getByText('Test Design')).toBeInTheDocument();
  });

  it('shows bin dimensions', () => {
    render(<DesignGridItem {...defaultProps} />);
    expect(screen.getByText(/2×2×3u/i)).toBeInTheDocument();
  });

  it('shows active badge when active', () => {
    render(<DesignGridItem {...defaultProps} isActive={true} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('does not show active badge when not active', () => {
    render(<DesignGridItem {...defaultProps} isActive={false} />);
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    render(<DesignGridItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('option'));
    expect(defaultProps.onSelect).toHaveBeenCalled();
  });

  it('calls onSelect when Enter key pressed', () => {
    render(<DesignGridItem {...defaultProps} isFocused={true} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: 'Enter' });
    expect(defaultProps.onSelect).toHaveBeenCalled();
  });

  it('calls onSelect when Space key pressed', () => {
    render(<DesignGridItem {...defaultProps} isFocused={true} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: ' ' });
    expect(defaultProps.onSelect).toHaveBeenCalled();
  });

  it('shows thumbnail image when available', () => {
    const designWithThumbnail = {
      ...mockDesign,
      thumbnail: 'data:image/png;base64,test',
    };
    render(<DesignGridItem {...defaultProps} design={designWithThumbnail} />);
    // The img element has alt="" which means it won't have role="img" by default
    const img = screen.getByAltText('');
    expect(img).toBeInTheDocument();
  });

  it('renders design actions', () => {
    render(<DesignGridItem {...defaultProps} />);
    expect(screen.getByTestId('design-actions')).toBeInTheDocument();
  });

  it('shows compartment count when > 1', () => {
    const designWithCompartments = {
      ...mockDesign,
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          cols: 2,
          rows: 2,
          thickness: 1.2,
          cells: [0, 1, 2, 3],
        },
      },
    };
    render(<DesignGridItem {...defaultProps} design={designWithCompartments} />);
    expect(screen.getByText(/4 comp\./i)).toBeInTheDocument();
  });

  it('applies active border styling when active', () => {
    render(<DesignGridItem {...defaultProps} isActive={true} />);
    const container = screen.getByRole('option');
    expect(container).toHaveClass('border-accent');
  });

  it('calls onFocus when focused', () => {
    render(<DesignGridItem {...defaultProps} />);
    fireEvent.focus(screen.getByRole('option'));
    expect(defaultProps.onFocus).toHaveBeenCalled();
  });
});
