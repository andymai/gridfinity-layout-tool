import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { Menu } from '@/design-system';
import { BaseplateMenuItems, BaseplateSelector } from './BaseplateSelector';

const ACTIVE = baseplateDesignId('bp-1');

const mocks = vi.hoisted(() => {
  const renameDesign = vi.fn();
  return {
    renameDesign,
    addToast: vi.fn(),
    setShowBaseplateLibrary: vi.fn(),
    createBaseplate: vi.fn(),
    newBaseplate: { creating: false },
    libraryState: {
      list: [
        {
          id: 'bp-1' as ReturnType<typeof baseplateDesignId>,
          name: 'Baseplate 1',
          updatedAt: '2024-01-01',
        },
        {
          id: 'bp-2' as ReturnType<typeof baseplateDesignId>,
          name: 'Deep Drawer',
          updatedAt: '2024-01-02',
        },
      ],
      activeBaseplateId: 'bp-1' as ReturnType<typeof baseplateDesignId> | null,
      switchActive: vi.fn(),
      saveCurrentAsNew: vi.fn(),
      forkActive: vi.fn(),
      renameDesign,
      duplicateDesign: vi.fn(),
      deleteDesign: vi.fn(),
    },
  };
});

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => mocks.libraryState,
}));

vi.mock('@/features/baseplate/hooks/useNewBaseplate', () => ({
  useNewBaseplate: () => ({
    createBaseplate: mocks.createBaseplate,
    creating: mocks.newBaseplate.creating,
  }),
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) =>
    selector({ setShowBaseplateLibrary: mocks.setShowBaseplateLibrary }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: mocks.addToast }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const nameButton = () => screen.getByText('Baseplate 1');
const nameInput = () => screen.getByLabelText('baseplate.library.namePrompt');

describe('BaseplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraryState.activeBaseplateId = ACTIVE;
    mocks.newBaseplate.creating = false;
  });

  it('shows the active design name', () => {
    render(<BaseplateSelector />);
    expect(nameButton()).toBeInTheDocument();
  });

  it('opens the baseplate list', () => {
    render(<BaseplateSelector />);
    fireEvent.click(screen.getByLabelText('baseplate.library.openList'));
    expect(mocks.setShowBaseplateLibrary).toHaveBeenCalledWith(true);
  });

  // An active design always exists and autosaves, so there is nothing to save.
  it('offers no save or save-as actions', () => {
    render(<BaseplateSelector />);
    expect(screen.queryByText('common.save')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('starts a new baseplate from the button beside the list', () => {
    render(<BaseplateSelector />);
    const list = screen.getByRole('button', { name: 'baseplate.library.openList' });
    const create = screen.getByRole('button', { name: 'baseplate.library.newBaseplate' });
    expect(list.nextElementSibling).toBe(create);

    fireEvent.click(create);
    expect(mocks.createBaseplate).toHaveBeenCalledOnce();
    expect(mocks.setShowBaseplateLibrary).not.toHaveBeenCalled();
  });

  it('disables New baseplate while a design is being created', () => {
    mocks.newBaseplate.creating = true;
    render(<BaseplateSelector />);
    expect(screen.getByRole('button', { name: 'baseplate.library.newBaseplate' })).toBeDisabled();
  });

  it('renames on Enter', async () => {
    mocks.renameDesign.mockResolvedValue(ok({ id: ACTIVE, name: 'Shallow' }));
    render(<BaseplateSelector />);

    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value: 'Shallow' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });

    await waitFor(() => expect(mocks.renameDesign).toHaveBeenCalledWith(ACTIVE, 'Shallow'));
  });

  it('renames on blur', async () => {
    mocks.renameDesign.mockResolvedValue(ok({ id: ACTIVE, name: 'Shallow' }));
    render(<BaseplateSelector />);

    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value: 'Shallow' } });
    fireEvent.blur(nameInput());

    await waitFor(() => expect(mocks.renameDesign).toHaveBeenCalledWith(ACTIVE, 'Shallow'));
  });

  it('trims the name before renaming', async () => {
    mocks.renameDesign.mockResolvedValue(ok({ id: ACTIVE, name: 'Shallow' }));
    render(<BaseplateSelector />);

    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value: '  Shallow  ' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });

    await waitFor(() => expect(mocks.renameDesign).toHaveBeenCalledWith(ACTIVE, 'Shallow'));
  });

  it('discards the edit on Escape', () => {
    render(<BaseplateSelector />);
    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value: 'Nope' } });
    fireEvent.keyDown(nameInput(), { key: 'Escape' });

    expect(mocks.renameDesign).not.toHaveBeenCalled();
    expect(nameButton()).toBeInTheDocument();
  });

  it.each([
    ['an empty name', '   '],
    ['an unchanged name', 'Baseplate 1'],
  ])('treats %s as a no-op rather than a rename', async (_label, value) => {
    render(<BaseplateSelector />);
    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });

    await waitFor(() => expect(nameButton()).toBeInTheDocument());
    expect(mocks.renameDesign).not.toHaveBeenCalled();
  });

  it('surfaces a failed rename', async () => {
    mocks.renameDesign.mockResolvedValue(err({ type: 'STORAGE_ERROR' }));
    render(<BaseplateSelector />);

    fireEvent.click(nameButton());
    fireEvent.change(nameInput(), { target: { value: 'Shallow' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith('toast.baseplateSaveFailed', 'error')
    );
  });
});

describe('BaseplateMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.newBaseplate.creating = false;
  });

  const renderInMenu = () =>
    render(
      <Menu.Root open onClose={vi.fn()} position={{ x: 0, y: 0 }}>
        <BaseplateMenuItems />
      </Menu.Root>
    );

  it('opens the baseplate list', () => {
    renderInMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'baseplate.library.baseplates' }));
    expect(mocks.setShowBaseplateLibrary).toHaveBeenCalledWith(true);
    expect(mocks.createBaseplate).not.toHaveBeenCalled();
  });

  it('starts a new baseplate', () => {
    renderInMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'baseplate.library.newBaseplate' }));
    expect(mocks.createBaseplate).toHaveBeenCalledOnce();
  });

  it('disables New baseplate while a design is being created', () => {
    mocks.newBaseplate.creating = true;
    renderInMenu();
    expect(
      screen.getByRole('menuitem', { name: 'baseplate.library.newBaseplate' })
    ).toHaveAttribute('aria-disabled', 'true');
  });
});
