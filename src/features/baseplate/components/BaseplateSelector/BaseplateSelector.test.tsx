import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
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
    // Settable: a fresh layout has no baseplateParams at all, which is the
    // state that broke Save (#2591). Pinning it to fakeParams here is what
    // hid the bug from these tests.
    storeParams: { value: fakeParams },
    addToast: vi.fn(),
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
    selector({ layout: { baseplateParams: mocks.storeParams.value } }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: mocks.addToast }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('BaseplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraryState.activeBaseplateId = null;
    mocks.storeParams.value = mocks.fakeParams;
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

  // #2591: a fresh layout has no baseplateParams. The page renders from
  // DEFAULT_BASEPLATE_PARAMS, so it looks configured while Save saw undefined
  // and threw the name away without a word.
  it('saves on a fresh layout that has no baseplateParams yet', async () => {
    mocks.storeParams.value = undefined;
    mocks.saveCurrentAsNew.mockResolvedValue(
      ok({ id: baseplateDesignId('bp-3'), params: mocks.fakeParams })
    );
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    fireEvent.change(input, { target: { value: 'Fresh Plate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mocks.saveCurrentAsNew).toHaveBeenCalledTimes(1));
    expect(mocks.saveCurrentAsNew.mock.calls[0][0]).toBe('Fresh Plate');
    // Falls back to the defaults the page is already rendering.
    expect(mocks.saveCurrentAsNew.mock.calls[0][1]).toMatchObject(DEFAULT_BASEPLATE_PARAMS);
  });

  it('surfaces a failed save instead of silently cancelling', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(err({ type: 'STORAGE_ERROR' }));
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    fireEvent.change(input, { target: { value: 'Doomed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith('toast.baseplateSaveFailed', 'error')
    );
    expect(mocks.setActiveBaseplate).not.toHaveBeenCalled();
  });

  // A failed save is usually transient, so retrying shouldn't cost a re-type.
  it('keeps the name form open after a failed save so it can be retried', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(err({ type: 'STORAGE_ERROR' }));
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    fireEvent.change(screen.getByLabelText('baseplate.library.namePrompt'), {
      target: { value: 'Doomed' },
    });
    fireEvent.keyDown(screen.getByLabelText('baseplate.library.namePrompt'), { key: 'Enter' });

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Doomed');

    // And a retry that succeeds closes the form and points the layout at it.
    mocks.saveCurrentAsNew.mockResolvedValue(
      ok({ id: baseplateDesignId('bp-9'), params: mocks.fakeParams })
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(mocks.setActiveBaseplate).toHaveBeenCalledWith(
        baseplateDesignId('bp-9'),
        mocks.fakeParams
      )
    );
    expect(screen.queryByLabelText('baseplate.library.namePrompt')).toBeNull();
  });

  it('still closes the form when Escape backs out of a failed save', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(err({ type: 'STORAGE_ERROR' }));
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    fireEvent.keyDown(screen.getByLabelText('baseplate.library.namePrompt'), { key: 'Enter' });
    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByLabelText('baseplate.library.namePrompt'), { key: 'Escape' });
    expect(screen.queryByLabelText('baseplate.library.namePrompt')).toBeNull();
  });

  it('treats an empty name as a cancel, with no error toast', async () => {
    render(<BaseplateSelector />);

    fireEvent.click(screen.getByText('common.save'));
    const input = screen.getByLabelText('baseplate.library.namePrompt');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.queryByLabelText('baseplate.library.namePrompt')).toBeNull());
    expect(mocks.saveCurrentAsNew).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });
});
