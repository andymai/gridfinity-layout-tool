import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { BaseplateSelector } from './BaseplateSelector';

const mocks = vi.hoisted(() => {
  const switchActive = vi.fn(() => Promise.resolve(ok({})));
  const saveCurrentAsNew = vi.fn();
  const forkActive = vi.fn();
  const fakeParams = { magnetHoles: false };
  return {
    switchActive,
    saveCurrentAsNew,
    forkActive,
    fakeParams,
    setActiveBaseplate: vi.fn(),
    setShowBaseplateLibrary: vi.fn(),
    libraryState: {
      list: [
        {
          id: 'bp-1' as ReturnType<typeof baseplateDesignId>,
          name: 'One',
          updatedAt: '2024-01-01',
        },
        {
          id: 'bp-2' as ReturnType<typeof baseplateDesignId>,
          name: 'Two',
          updatedAt: '2024-01-02',
        },
      ],
      activeBaseplateId: null as ReturnType<typeof baseplateDesignId> | null,
      switchActive,
      saveCurrentAsNew,
      forkActive,
      renameDesign: vi.fn(),
      duplicateDesign: vi.fn(),
      deleteDesign: vi.fn(),
    },
  };
});

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => mocks.libraryState,
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate: mocks.setActiveBaseplate }),
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) =>
    selector({ setShowBaseplateLibrary: mocks.setShowBaseplateLibrary }),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({ layout: { baseplateParams: mocks.fakeParams } }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('BaseplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraryState.activeBaseplateId = null;
  });

  it('New starts a fresh draft via setActiveBaseplate(null, ...)', () => {
    render(<BaseplateSelector />);
    fireEvent.click(screen.getByText('baseplate.library.new'));
    expect(mocks.setActiveBaseplate).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveBaseplate.mock.calls[0][0]).toBeNull();
  });

  it('switching the dropdown calls switchActive with the selected id', () => {
    render(<BaseplateSelector />);
    const select = screen.getByLabelText('baseplate.library.selectLabel');
    fireEvent.change(select, { target: { value: 'bp-2' } });
    expect(mocks.switchActive).toHaveBeenCalledWith(baseplateDesignId('bp-2'));
  });

  it('Save on a draft prompts a name then saves and points the layout at it', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(
      ok({ id: baseplateDesignId('bp-3'), params: mocks.fakeParams })
    );
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    fireEvent.change(input, { target: { value: 'Fresh Plate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(mocks.saveCurrentAsNew).toHaveBeenCalledWith('Fresh Plate', mocks.fakeParams)
    );
    await waitFor(() =>
      expect(mocks.setActiveBaseplate).toHaveBeenCalledWith(
        baseplateDesignId('bp-3'),
        mocks.fakeParams
      )
    );
  });

  it('Save As detaches the active design into an unsaved draft via forkActive', () => {
    mocks.libraryState.activeBaseplateId = baseplateDesignId('bp-1');
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('baseplate.library.saveAs'));

    expect(mocks.forkActive).toHaveBeenCalledTimes(1);
  });

  it('Manage opens the baseplate library modal', () => {
    render(<BaseplateSelector />);
    fireEvent.click(screen.getByText('baseplate.library.manage'));
    expect(mocks.setShowBaseplateLibrary).toHaveBeenCalledWith(true);
  });
});
