import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignActions } from './DesignActions';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';
import type { SavedDesign } from '../../types';
import { designId } from '@/core/types';

const mockDesign: SavedDesign = {
  id: designId('design-1'),
  name: 'Test Bin',
  params: DEFAULT_BIN_PARAMS,
  thumbnail: null,
  exportFileNameConfig: null,
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-22T12:00:00.000Z',
};

describe('DesignActions', () => {
  const defaultProps = {
    design: mockDesign,
    isActive: false,
    onLoad: vi.fn(),
    onDownloadJSON: vi.fn(),
    onRename: vi.fn(),
    onEditTags: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overflow menu button', () => {
    render(<DesignActions {...defaultProps} />);

    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });

  it('opens menu on button click', async () => {
    render(<DesignActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  // Wiring guard: the menu role advertises arrow traversal, so the shared
  // keyboard hook must stay attached.
  it('focuses the first item on open and traverses with the arrow keys', async () => {
    render(<DesignActions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    const items = await screen.findAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
  });

  it('shows Load option when not active', async () => {
    render(<DesignActions {...defaultProps} isActive={false} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /^load$/i })).toBeInTheDocument();
    });
  });

  it('hides Load option when active', async () => {
    render(<DesignActions {...defaultProps} isActive={true} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /^load$/i })).not.toBeInTheDocument();
    });
  });

  it('calls onLoad when Load is clicked', async () => {
    const onLoad = vi.fn();
    render(<DesignActions {...defaultProps} onLoad={onLoad} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /^load$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /^load$/i }));
    expect(onLoad).toHaveBeenCalled();
  });

  it('calls onPlaceInLayout when Place in layout is clicked', async () => {
    const onPlaceInLayout = vi.fn();
    render(<DesignActions {...defaultProps} onPlaceInLayout={onPlaceInLayout} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /place in layout/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /place in layout/i }));
    expect(onPlaceInLayout).toHaveBeenCalled();
  });

  it('omits Place in layout when the callback is absent', async () => {
    render(<DesignActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    expect(screen.queryByRole('menuitem', { name: /place in layout/i })).not.toBeInTheDocument();
  });

  it('calls onRename when Rename is clicked', async () => {
    const onRename = vi.fn();
    render(<DesignActions {...defaultProps} onRename={onRename} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    expect(onRename).toHaveBeenCalled();
  });

  it('calls onEditTags when Edit tags is clicked', async () => {
    const onEditTags = vi.fn();
    render(<DesignActions {...defaultProps} onEditTags={onEditTags} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /edit tags/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /edit tags/i }));
    expect(onEditTags).toHaveBeenCalled();
  });

  it('calls onDuplicate when Duplicate is clicked', async () => {
    const onDuplicate = vi.fn();
    render(<DesignActions {...defaultProps} onDuplicate={onDuplicate} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalled();
  });

  it('calls onDownloadJSON when Download JSON is clicked', async () => {
    const onDownloadJSON = vi.fn();
    render(<DesignActions {...defaultProps} onDownloadJSON={onDownloadJSON} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /download json/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /download json/i }));
    expect(onDownloadJSON).toHaveBeenCalled();
  });

  it('requires two clicks to delete', async () => {
    const onDelete = vi.fn();
    render(<DesignActions {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    // First click - should not delete yet
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();

    // Second click - should delete
    fireEvent.click(screen.getByRole('menuitem', { name: /click again to delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('closes menu when action is taken', async () => {
    render(<DesignActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('toggles menu closed on second button click', async () => {
    render(<DesignActions {...defaultProps} />);

    // Open
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Close
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});
