import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { ContextMenuContainer } from './ContextMenuContainer';

describe('ContextMenuContainer', () => {
  const defaultProps = {
    isOpen: true,
    position: { x: 100, y: 200 },
    onClose: vi.fn(),
    menuRef: createRef<HTMLDivElement>(),
    children: <div>Menu Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(<ContextMenuContainer {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders menu when isOpen is true', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Menu Content')).toBeInTheDocument();
  });

  it('positions menu at specified coordinates', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ContextMenuContainer {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has accessible menu role and label', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('aria-label', 'Context menu');
  });

  it('focuses first menu item when opened', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps} isOpen={true}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Item 1' })).toHaveFocus();
    });
  });

  it('navigates to next item with ArrowDown', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(items[1]).toHaveFocus();
  });

  it('wraps to first item when ArrowDown at end', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[1].focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(items[0]).toHaveFocus();
  });

  it('navigates to previous item with ArrowUp', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[1].focus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(items[0]).toHaveFocus();
  });

  it('wraps to last item when ArrowUp at beginning', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(items[2]).toHaveFocus();
  });

  it('focuses first item with Home key', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[2].focus();
    fireEvent.keyDown(menu, { key: 'Home' });

    expect(items[0]).toHaveFocus();
  });

  it('focuses last item with End key', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    fireEvent.keyDown(menu, { key: 'End' });

    expect(items[2]).toHaveFocus();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem">Item 2</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps} onClose={onClose}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skips disabled menu items when navigating', async () => {
    const MenuWithItems = () => (
      <>
        <button role="menuitem">Item 1</button>
        <button role="menuitem" disabled>
          Item 2 (Disabled)
        </button>
        <button role="menuitem">Item 3</button>
      </>
    );

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
    const item3 = screen.getByRole('menuitem', { name: 'Item 3' });

    item1.focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    // Should skip disabled Item 2 and focus Item 3
    expect(item3).toHaveFocus();
  });

  it('handles menu with no focusable items', () => {
    const MenuWithNoItems = () => <div>No items</div>;

    render(
      <ContextMenuContainer {...defaultProps}>
        <MenuWithNoItems />
      </ContextMenuContainer>
    );

    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    // Should not throw error
    expect(menu).toBeInTheDocument();
  });
});
