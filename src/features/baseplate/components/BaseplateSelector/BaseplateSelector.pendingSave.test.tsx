import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { Menu } from '@/design-system';
import { BaseplateMenuItems, BaseplateSelector } from './BaseplateSelector';

const mocks = vi.hoisted(() => ({
  saveCurrentAsNew: vi.fn(),
  setActiveBaseplate: vi.fn(),
}));

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => ({
    list: [{ id: 'bp-1', name: 'Baseplate 1', updatedAt: '2024-01-01' }],
    activeBaseplateId: 'bp-1',
    renameDesign: vi.fn(),
    saveCurrentAsNew: mocks.saveCurrentAsNew,
  }),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate: mocks.setActiveBaseplate }),
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) =>
    selector({ setShowBaseplateLibrary: vi.fn() }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: vi.fn() }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const created = { id: baseplateDesignId('bp-new'), params: { magnetHoles: true } };

function PhoneMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open menu
      </button>
      <Menu.Root open={open} onClose={() => setOpen(false)} position={{ x: 0, y: 0 }}>
        <BaseplateMenuItems />
      </Menu.Root>
    </>
  );
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'open menu' }));
const menuNewItem = () => screen.getByRole('menuitem', { name: 'baseplate.library.newBaseplate' });

describe('New baseplate while a save is pending', () => {
  let resolveSave: (value: unknown) => void = () => undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveCurrentAsNew.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
  });

  it('stays disabled when the phone menu reopens, so one click makes one plate', async () => {
    render(<PhoneMenu />);
    openMenu();
    fireEvent.click(menuNewItem());
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    openMenu();
    expect(menuNewItem()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(menuNewItem());
    expect(mocks.saveCurrentAsNew).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSave(ok(created));
    });
    expect(mocks.setActiveBaseplate).toHaveBeenCalledOnce();
    expect(menuNewItem()).not.toHaveAttribute('aria-disabled');
  });

  it('disables the header button while the phone menu save is pending', async () => {
    render(
      <>
        <BaseplateSelector />
        <PhoneMenu />
      </>
    );
    openMenu();
    fireEvent.click(menuNewItem());

    const headerButton = screen.getByRole('button', { name: 'baseplate.library.newBaseplate' });
    expect(headerButton).toBeDisabled();

    await act(async () => {
      resolveSave(ok(created));
    });
    expect(headerButton).toBeEnabled();
  });
});
