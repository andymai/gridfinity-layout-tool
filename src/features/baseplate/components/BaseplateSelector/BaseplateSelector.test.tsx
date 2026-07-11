import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { BaseplateSelector } from './BaseplateSelector';

const switchActive = vi.fn(() => Promise.resolve(ok({})));
const saveCurrentAsNew = vi.fn();
const forkActive = vi.fn();
const setActiveBaseplate = vi.fn();
const setShowBaseplateLibrary = vi.fn();

let libraryState = {
  list: [
    { id: baseplateDesignId('bp-1'), name: 'One', updatedAt: '2024-01-01' },
    { id: baseplateDesignId('bp-2'), name: 'Two', updatedAt: '2024-01-02' },
  ],
  activeBaseplateId: null as ReturnType<typeof baseplateDesignId> | null,
  switchActive,
  saveCurrentAsNew,
  forkActive,
  renameDesign: vi.fn(),
  duplicateDesign: vi.fn(),
  deleteDesign: vi.fn(),
};

const fakeParams = { magnetHoles: false };

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => libraryState,
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate }),
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) => selector({ setShowBaseplateLibrary }),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({ layout: { baseplateParams: fakeParams } }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('BaseplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryState = { ...libraryState, activeBaseplateId: null };
  });

  it('New starts a fresh draft via setActiveBaseplate(null, ...)', () => {
    render(<BaseplateSelector />);
    fireEvent.click(screen.getByText('baseplate.library.new'));
    expect(setActiveBaseplate).toHaveBeenCalledTimes(1);
    expect(setActiveBaseplate.mock.calls[0][0]).toBeNull();
  });

  it('switching the dropdown calls switchActive with the selected id', () => {
    render(<BaseplateSelector />);
    const select = screen.getByLabelText('baseplate.library.selectLabel');
    fireEvent.change(select, { target: { value: 'bp-2' } });
    expect(switchActive).toHaveBeenCalledWith(baseplateDesignId('bp-2'));
  });

  it('Save on a draft prompts a name then saves and points the layout at it', async () => {
    saveCurrentAsNew.mockResolvedValue(ok({ id: baseplateDesignId('bp-3'), params: fakeParams }));
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    fireEvent.change(input, { target: { value: 'Fresh Plate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(saveCurrentAsNew).toHaveBeenCalledWith('Fresh Plate', fakeParams));
    await waitFor(() =>
      expect(setActiveBaseplate).toHaveBeenCalledWith(baseplateDesignId('bp-3'), fakeParams)
    );
  });

  it('Save As detaches the active design into an unsaved draft via forkActive', () => {
    libraryState = { ...libraryState, activeBaseplateId: baseplateDesignId('bp-1') };
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('baseplate.library.saveAs'));

    expect(forkActive).toHaveBeenCalledTimes(1);
  });

  it('Manage opens the baseplate library modal', () => {
    render(<BaseplateSelector />);
    fireEvent.click(screen.getByText('baseplate.library.manage'));
    expect(setShowBaseplateLibrary).toHaveBeenCalledWith(true);
  });
});
