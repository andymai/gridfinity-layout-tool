import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
