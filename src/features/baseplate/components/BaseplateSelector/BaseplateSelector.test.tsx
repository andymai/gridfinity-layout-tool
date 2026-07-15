import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { BaseplateSelector } from './BaseplateSelector';

const ACTIVE = baseplateDesignId('bp-1');

const mocks = vi.hoisted(() => {
  const renameDesign = vi.fn();
  return {
    renameDesign,
    addToast: vi.fn(),
    setShowBaseplateLibrary: vi.fn(),
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

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) =>
    selector({ setShowBaseplateLibrary: mocks.setShowBaseplateLibrary }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: mocks.addToast }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const nameButton = () => screen.getByText('Baseplate 1');
const nameInput = () => screen.getByLabelText('baseplate.library.namePrompt');

describe('BaseplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraryState.activeBaseplateId = ACTIVE;
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

  // There is no Save/Save As/New here on purpose — an active design always
  // exists and autosaves, so the header matches the designer's.
  it('offers no save, save-as, or new actions', () => {
    render(<BaseplateSelector />);
    expect(screen.queryByText('baseplate.library.new')).not.toBeInTheDocument();
    expect(screen.queryByText('common.save')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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
