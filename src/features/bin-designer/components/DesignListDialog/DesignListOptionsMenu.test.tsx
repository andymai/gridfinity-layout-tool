// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignListOptionsMenu } from './DesignListOptionsMenu';

function setup(overrides?: { open?: boolean; customDefaultActive?: boolean }) {
  const handlers = {
    onClose: vi.fn(),
    onSetDefault: vi.fn(),
    onOpenTagManager: vi.fn(),
    onResetFactory: vi.fn(),
  };
  render(
    <DesignListOptionsMenu
      open={overrides?.open ?? true}
      position={{ x: 0, y: 0 }}
      customDefaultActive={overrides?.customDefaultActive ?? false}
      {...handlers}
    />
  );
  return handlers;
}

describe('DesignListOptionsMenu', () => {
  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the default-management actions when open', () => {
    setup();
    expect(
      screen.getByRole('menuitem', { name: 'Set as default for new bins' })
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manage tags…' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reset to factory defaults' })).toBeInTheDocument();
  });

  it('disables reset and hides the badge without a custom default', () => {
    setup({ customDefaultActive: false });
    expect(screen.getByRole('menuitem', { name: 'Reset to factory defaults' })).toBeDisabled();
    expect(screen.queryByText('Custom default active')).not.toBeInTheDocument();
  });

  it('enables reset and shows the badge when a custom default is active', () => {
    setup({ customDefaultActive: true });
    expect(screen.getByRole('menuitem', { name: 'Reset to factory defaults' })).not.toBeDisabled();
    expect(screen.getByText('Custom default active')).toBeInTheDocument();
  });

  it('fires the matching handler for each menu item', () => {
    const h = setup({ customDefaultActive: true });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set as default for new bins' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage tags…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset to factory defaults' }));
    expect(h.onSetDefault).toHaveBeenCalled();
    expect(h.onOpenTagManager).toHaveBeenCalled();
    expect(h.onResetFactory).toHaveBeenCalled();
  });
});
