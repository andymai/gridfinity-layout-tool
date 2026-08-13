// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { INITIAL_PRINT_DIALOG_STATE, usePrintDialogStore } from '../../store/printDialogStore';
import { PrintDialog } from './PrintDialog';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('../../utils/printPhoto', () => ({ preparePrintPhoto: vi.fn() }));

const api = vi.hoisted(() => ({ savePrint: vi.fn(), deletePrint: vi.fn() }));
vi.mock('../../api/printsClient', () => api);

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: toast }),
}));

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const SAVED: CommunityPrint = {
  id: 'abc123def456:aaa',
  designId: 'abc123def456',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Casey',
  photos: [],
  settings: {
    material: 'pla',
    nozzleMm: 0.4,
    layerHeightMm: 0.2,
    printMinutes: 120,
    printer: 'bambu-p1s',
  },
  fitVerdict: 'as-designed',
  note: '',
  createdAt: 1,
  updatedAt: 1,
  status: 'live',
};

function openDialog(existing: CommunityPrint | null = null, signedIn = true): void {
  usePrintDialogStore.getState().open({
    designId: 'abc123def456',
    designName: 'Socket Organizer',
    signedIn,
    existing,
  });
}

/**
 * Seed the store before mounting. Writing to it after render() lands outside
 * React's act() and the assertion then runs before the re-render flushes.
 */
function renderOpen(
  handlers: { onSaved?: () => void; onDeleted?: () => void } = {},
  existing: CommunityPrint | null = null,
  signedIn = true
) {
  openDialog(existing, signedIn);
  return render(
    <PrintDialog onSaved={handlers.onSaved ?? vi.fn()} onDeleted={handlers.onDeleted ?? vi.fn()} />
  );
}

/**
 * Fill every required field. The name is included deliberately: it is seeded
 * from localStorage, which is empty in jsdom, so omitting it blocks submit.
 */
function completeForm(): void {
  fireEvent.change(screen.getByLabelText('community.print.nameLabel'), {
    target: { value: 'Casey' },
  });
  fireEvent.change(screen.getByLabelText('community.print.printerLabel'), {
    target: { value: 'bambu-p1s' },
  });
  fireEvent.change(screen.getByTestId('print-hours'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('radio', { name: 'community.print.fit.asDesigned' }));
  // A verdict alone is a bare vote; the form wants a photo or a note with it.
  fireEvent.change(screen.getByLabelText('community.print.noteLabel'), {
    target: { value: 'Printed fine.' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  usePrintDialogStore.setState({ ...INITIAL_PRINT_DIALOG_STATE });
  api.savePrint.mockResolvedValue(ok({ print: SAVED, count: 1 }));
  api.deletePrint.mockResolvedValue(ok({ count: 0 }));
});

describe('PrintDialog', () => {
  it('renders nothing while closed', () => {
    render(<PrintDialog onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.queryByTestId('print-form')).toBeNull();
  });

  // `fullScreen` and `mobilePresentation` are mutually exclusive mobile
  // layouts. Passing both emitted `rounded-none` and `rounded-t-2xl` together
  // (tailwind-merge keeps both, since rounded-t does not supersede rounded),
  // leaving stylesheet order to decide the corners of a full-height box that
  // was simultaneously pinned to the bottom.
  it('picks one mobile layout rather than stacking two contradictory ones', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-md:h-dvh');
    expect(dialog.className).not.toContain('max-md:rounded-t-2xl');
    expect(dialog.className).not.toContain('max-md:bottom-0');
  });

  it('shows the sign-in step for an anonymous caller', () => {
    renderOpen({}, null, false);
    expect(screen.getByText('community.print.signinMessage')).toBeInTheDocument();
    expect(screen.queryByTestId('print-form')).toBeNull();
  });

  it('blocks submit and shows issues while required fields are missing', () => {
    renderOpen();

    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    expect(api.savePrint).not.toHaveBeenCalled();
    expect(screen.getByText('community.print.fitRequired')).toBeInTheDocument();
  });

  it('submits a complete form and reports the saved print', async () => {
    const onSaved = vi.fn();
    renderOpen({ onSaved });

    completeForm();
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(SAVED, 1));
    expect(api.savePrint).toHaveBeenCalledWith(
      'abc123def456',
      expect.objectContaining({
        printer: 'bambu-p1s',
        printMinutes: 120,
        fitVerdict: 'as-designed',
      })
    );
  });

  it('submits with nothing but a verdict and a note', async () => {
    renderOpen();

    fireEvent.change(screen.getByLabelText('community.print.nameLabel'), {
      target: { value: 'Casey' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'community.print.fit.asDesigned' }));
    fireEvent.change(screen.getByLabelText('community.print.noteLabel'), {
      target: { value: 'Printed fine.' },
    });
    // Every settings field left as it opened.
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(api.savePrint).toHaveBeenCalled());
    const [, input] = api.savePrint.mock.calls[0] as [string, Record<string, unknown>];
    // Omitted, not zeroed and not defaulted: a value nobody chose must not
    // reach the modes and medians. A pre-filled 0.4/0.2/PLA would have.
    for (const field of ['material', 'nozzleMm', 'layerHeightMm', 'printMinutes', 'printer']) {
      expect(input).not.toHaveProperty(field);
    }
  });

  it('can report a nozzle without naming a material', async () => {
    renderOpen();

    fireEvent.change(screen.getByLabelText('community.print.nameLabel'), {
      target: { value: 'Casey' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'community.print.fit.asDesigned' }));
    fireEvent.change(screen.getByLabelText('community.print.noteLabel'), {
      target: { value: 'Printed fine.' },
    });
    fireEvent.change(screen.getByLabelText('community.print.nozzleLabel'), {
      target: { value: '0.6' },
    });
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(api.savePrint).toHaveBeenCalled());
    const [, input] = api.savePrint.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.nozzleMm).toBe(0.6);
    expect(input).not.toHaveProperty('material');
  });

  it('asks for a photo or a note before accepting a bare verdict', () => {
    renderOpen();

    fireEvent.change(screen.getByLabelText('community.print.nameLabel'), {
      target: { value: 'Casey' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'community.print.fit.asDesigned' }));
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    expect(screen.getByTestId('print-content-required')).toBeInTheDocument();
    expect(api.savePrint).not.toHaveBeenCalled();
  });

  it('omits the free-text model unless the printer is "other"', async () => {
    renderOpen();

    completeForm();
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(api.savePrint).toHaveBeenCalled());
    const [, input] = api.savePrint.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.printerOther).toBeUndefined();
  });

  it('renders a server error without losing the form', async () => {
    api.savePrint.mockResolvedValue(err({ kind: 'contentBlocked', message: 'no' }));
    renderOpen();

    completeForm();
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('print-dialog-error')).toHaveTextContent(
        'community.print.error.blocked'
      )
    );
    expect(screen.getByTestId('print-form')).toBeInTheDocument();
  });

  it('returns to sign-in when the session lapsed mid-flow', async () => {
    api.savePrint.mockResolvedValue(err({ kind: 'needsAuth' }));
    renderOpen();

    completeForm();
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(usePrintDialogStore.getState().phase).toBe('signin'));
  });

  it('drops a non-positive filament entry rather than letting the server reject it', async () => {
    renderOpen();

    completeForm();
    fireEvent.change(screen.getByLabelText('community.print.filamentLabel'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('print-dialog-submit'));

    await waitFor(() => expect(api.savePrint).toHaveBeenCalled());
    const [, input] = api.savePrint.mock.calls[0] as [string, Record<string, unknown>];
    // The server floor is 0.1, so 0 is an unset field, not a value.
    expect(input.filamentGrams).toBeNull();
  });

  it('does not carry validation errors across a close and reopen', () => {
    const { rerender } = renderOpen();

    fireEvent.click(screen.getByTestId('print-dialog-submit'));
    expect(screen.getByText('community.print.fitRequired')).toBeInTheDocument();

    usePrintDialogStore.getState().reset();
    rerender(<PrintDialog onSaved={vi.fn()} onDeleted={vi.fn()} />);
    openDialog();
    rerender(<PrintDialog onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.queryByText('community.print.fitRequired')).toBeNull();
  });

  it('offers delete only when editing', () => {
    const { unmount } = renderOpen();
    expect(screen.queryByTestId('print-dialog-delete')).toBeNull();
    unmount();

    renderOpen({}, SAVED);
    expect(screen.getByTestId('print-dialog-delete')).toBeInTheDocument();
  });

  it('deletes after confirmation and reports the new count', async () => {
    const onDeleted = vi.fn();
    renderOpen({ onDeleted }, SAVED);

    fireEvent.click(screen.getByTestId('print-dialog-delete'));
    fireEvent.click(screen.getAllByText('community.print.delete').at(-1) as HTMLElement);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(0));
    expect(api.deletePrint).toHaveBeenCalledWith('abc123def456');
  });
});
