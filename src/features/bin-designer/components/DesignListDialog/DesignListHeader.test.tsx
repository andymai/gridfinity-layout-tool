// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignListHeader } from './DesignListHeader';

function setup(overrides?: {
  showSelectButton?: boolean;
  optionsMenuOpen?: boolean;
  customDefaultActive?: boolean;
}) {
  const handlers = {
    onEnterSelect: vi.fn(),
    onShowImport: vi.fn(),
    onNewDesign: vi.fn(),
    onOpenOptionsMenu: vi.fn(),
    onClose: vi.fn(),
    showWorkshopButton: false,
  };
  render(
    <DesignListHeader
      showSelectButton={overrides?.showSelectButton ?? true}
      optionsMenuOpen={overrides?.optionsMenuOpen ?? false}
      customDefaultActive={overrides?.customDefaultActive ?? false}
      {...handlers}
    />
  );
  return handlers;
}

describe('DesignListHeader', () => {
  it('renders the title and primary actions', () => {
    setup();
    expect(screen.getByText('Saved Designs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Design' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
  });

  it('hides the Select button when showSelectButton is false', () => {
    setup({ showSelectButton: false });
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('fires the corresponding handler for each action', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Design' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(h.onEnterSelect).toHaveBeenCalled();
    expect(h.onShowImport).toHaveBeenCalled();
    expect(h.onNewDesign).toHaveBeenCalled();
    expect(h.onClose).toHaveBeenCalled();
  });

  it('reflects the options-menu open state via aria-expanded', () => {
    setup({ optionsMenuOpen: true });
    const optionsButton = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(optionsButton);
    expect(optionsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('annotates the options button when a custom default is active', () => {
    setup({ customDefaultActive: true });
    expect(
      screen.getByRole('button', { name: /More options — Custom default active/ })
    ).toBeInTheDocument();
  });
});
