import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutContextMenu } from './CutoutContextMenu';
import type { ContextMenuAction } from './CutoutContextMenu';

describe('CutoutContextMenu', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultActions: ContextMenuAction[] = [
    { label: 'Copy', onClick: vi.fn() },
    { label: 'Paste', onClick: vi.fn(), disabled: true },
    { label: 'Delete', onClick: vi.fn(), danger: true },
  ];

  it('renders menu items with correct labels', () => {
    render(<CutoutContextMenu x={100} y={100} actions={defaultActions} onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls action handler and onClose when action is clicked', () => {
    const actions: ContextMenuAction[] = [{ label: 'Copy', onClick: vi.fn() }];

    render(<CutoutContextMenu x={100} y={100} actions={actions} onClose={mockOnClose} />);

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);

    expect(actions[0].onClick).toHaveBeenCalledOnce();
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(
      <CutoutContextMenu x={100} y={100} actions={defaultActions} onClose={mockOnClose} />
    );

    // Find the backdrop (the fixed inset-0 div)
    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(backdrop!);
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('does not call handler when disabled item is clicked', () => {
    const actions: ContextMenuAction[] = [
      { label: 'Disabled Action', onClick: vi.fn(), disabled: true },
    ];

    render(<CutoutContextMenu x={100} y={100} actions={actions} onClose={mockOnClose} />);

    const disabledButton = screen.getByRole('button', { name: 'Disabled Action' });
    fireEvent.click(disabledButton);

    expect(actions[0].onClick).not.toHaveBeenCalled();
  });

  it('applies danger styling to danger items', () => {
    render(<CutoutContextMenu x={100} y={100} actions={defaultActions} onClose={mockOnClose} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton.className).toContain('text-red-400');
  });

  it('applies disabled styling to disabled items', () => {
    render(<CutoutContextMenu x={100} y={100} actions={defaultActions} onClose={mockOnClose} />);

    const pasteButton = screen.getByRole('button', { name: 'Paste' });
    expect(pasteButton).toBeDisabled();
    expect(pasteButton.className).toContain('opacity-50');
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<CutoutContextMenu x={100} y={100} actions={defaultActions} onClose={mockOnClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('renders dividers after actions with dividerAfter flag', () => {
    const actions: ContextMenuAction[] = [
      { label: 'Action 1', onClick: vi.fn(), dividerAfter: true },
      { label: 'Action 2', onClick: vi.fn() },
    ];

    const { container } = render(
      <CutoutContextMenu x={100} y={100} actions={actions} onClose={mockOnClose} />
    );

    const dividers = container.querySelectorAll('.border-t.border-stroke-subtle');
    expect(dividers).toHaveLength(1);
  });

  it('renders shortcut badges when actions have shortcuts', () => {
    const actions: ContextMenuAction[] = [
      { label: 'Copy', onClick: vi.fn(), shortcut: { keys: 'C', modifier: true } },
      { label: 'Delete', onClick: vi.fn(), shortcut: { keys: 'Del' } },
      { label: 'No Shortcut', onClick: vi.fn() },
    ];

    const { container } = render(
      <CutoutContextMenu x={100} y={100} actions={actions} onClose={mockOnClose} />
    );

    // Actions with shortcuts should render <kbd> elements
    const kbdElements = container.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThanOrEqual(2);
  });
});
