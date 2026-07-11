import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ok } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import { BaseplateLibraryModal } from './BaseplateLibraryModal';

const designs = [
  {
    id: baseplateDesignId('bp-1'),
    name: 'One',
    params: { magnetHoles: false },
    thumbnail: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: baseplateDesignId('bp-2'),
    name: 'Two',
    params: { magnetHoles: false },
    thumbnail: null,
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
];

const mocks = vi.hoisted(() => ({
  switchActive: vi.fn(),
  renameDesign: vi.fn(() => Promise.resolve(ok({}))),
  duplicateDesign: vi.fn(() => Promise.resolve(ok({}))),
  deleteDesign: vi.fn(() => Promise.resolve(ok(undefined))),
  setActiveBaseplate: vi.fn(),
  listDesigns: vi.fn(() => Promise.resolve(ok(designs))),
}));

vi.mock('@/features/baseplate/storage/BaseplateStorage', () => ({
  listDesigns: () => mocks.listDesigns(),
}));

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => ({
    list: [],
    activeBaseplateId: baseplateDesignId('bp-1'),
    switchActive: mocks.switchActive,
    saveCurrentAsNew: vi.fn(),
    forkActive: vi.fn(),
    renameDesign: mocks.renameDesign,
    duplicateDesign: mocks.duplicateDesign,
    deleteDesign: mocks.deleteDesign,
  }),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({
      layout: {
        activeBaseplateId: baseplateDesignId('bp-1'),
        baseplateParams: { magnetHoles: false },
      },
    }),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate: mocks.setActiveBaseplate }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

describe('BaseplateLibraryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('does not render when closed', () => {
    render(<BaseplateLibraryModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads and lists saved designs when open', async () => {
    render(<BaseplateLibraryModal isOpen onClose={vi.fn()} />);
    expect(await screen.findByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('closes via the close button', async () => {
    const onClose = vi.fn();
    render(<BaseplateLibraryModal isOpen onClose={onClose} />);
    await screen.findByText('One');
    fireEvent.click(screen.getByLabelText('baseplate.library.closeDialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape from a focused child despite the container stopPropagation', async () => {
    const onClose = vi.fn();
    render(<BaseplateLibraryModal isOpen onClose={onClose} />);
    await screen.findByText('One');
    // Dispatch a native event on the focused child so it propagates through the
    // container's stopPropagation. Only a capture-phase document listener fires
    // before that stop; a bubble-phase one would be starved (see the container's
    // onKeyDown). fireEvent.keyDown wouldn't exercise this — it invokes React
    // handlers directly rather than dispatching through the DOM.
    act(() => {
      screen
        .getByText('One')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the rename input from the overflow menu', async () => {
    render(<BaseplateLibraryModal isOpen onClose={vi.fn()} />);
    await screen.findByText('One');
    fireEvent.click(screen.getAllByRole('button', { name: /moreActions/ })[0]);
    fireEvent.click(screen.getByText('common.rename'));
    expect(screen.getByLabelText('baseplate.library.designName')).toBeInTheDocument();
  });

  it('delete opens the warning dialog and confirming orphans the current layout', async () => {
    render(<BaseplateLibraryModal isOpen onClose={vi.fn()} />);
    await screen.findByText('One');

    fireEvent.click(screen.getAllByRole('button', { name: /moreActions/ })[0]);
    fireEvent.click(screen.getByText('common.delete'));

    // Warning dialog notes the active layout uses the design being deleted.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('baseplate.library.deleteWarning.usedByCurrent')).toBeInTheDocument();

    fireEvent.click(screen.getByText('baseplate.library.deleteWarning.confirm'));

    await waitFor(() => expect(mocks.deleteDesign).toHaveBeenCalledWith(baseplateDesignId('bp-1')));
    await waitFor(() =>
      expect(mocks.setActiveBaseplate).toHaveBeenCalledWith(null, { magnetHoles: false })
    );
  });
});
