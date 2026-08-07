import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DrawerShapeActionsMenu } from './DrawerShapeActionsMenu';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const handlers = {
  onOpenCorners: vi.fn(),
  onOpenPen: vi.fn(),
  onOpenEditor: vi.fn(),
};

function renderMenu(hasOutline = false) {
  return render(<DrawerShapeActionsMenu hasOutline={hasOutline} {...handlers} />);
}

describe('DrawerShapeActionsMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a labelled icon trigger with no visible text', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'drawerShape.actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('');
  });

  it('keeps the menu closed until the trigger is pressed', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'drawerShape.actions' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('hides the cell editor entry until an outline exists', () => {
    renderMenu(false);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryByRole('menuitem', { name: 'drawerShape.edit' })).not.toBeInTheDocument();
  });

  it('offers all three authoring routes once an outline exists', () => {
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it.each([
    ['drawerShape.corners.open', 'onOpenCorners'],
    ['drawerShape.penOpen', 'onOpenPen'],
    ['drawerShape.edit', 'onOpenEditor'],
  ] as const)('runs %s and closes the menu', (label, handler) => {
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // The menu/menuitem roles promise arrow traversal and focus landing in the
  // list, so the menu is built on the design-system primitive that implements
  // it rather than a bare Popover of buttons.
  // Menu.Root defers the focus call to a rAF, so this has to settle.
  it('moves focus into the list on open', async () => {
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
  });

  it('traverses items with the arrow keys and wraps at the ends', () => {
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(items[items.length - 1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(items[0]).toHaveFocus();
  });

  it('closes on Escape', () => {
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
