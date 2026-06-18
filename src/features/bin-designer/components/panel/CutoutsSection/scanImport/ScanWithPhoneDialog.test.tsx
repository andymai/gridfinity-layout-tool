import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ScanWithPhoneDialog } from './ScanWithPhoneDialog';

const mockAddScanCutouts = vi.fn(() => 1);
vi.mock('./useScanImport', () => ({
  useScanImport: () => ({ addScanCutouts: mockAddScanCutouts }),
}));

// Keep the cross-device session out of these tests (no network / QR import);
// the awaiting state falls back to the manual-upload affordance. A mutable
// hoisted handle lets one test exercise the live "waiting for QR scan" branch.
const session = vi.hoisted(() => ({
  current: { phase: 'unavailable', url: null as string | null },
  onSvg: null as ((svg: string) => void) | null,
}));
vi.mock('./useScanSession', () => ({
  useScanSession: (_active: boolean, onSvg: (svg: string) => void) => {
    session.onSvg = onSvg;
    return session.current;
  },
}));

const mockAddToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

const RECT_SVG = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>`;

function uploadSvg(svg: string): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([svg], 'scan.svg', { type: 'image/svg+xml' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ScanWithPhoneDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = { phase: 'unavailable', url: null };
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the upload affordance in the awaiting state', () => {
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.upload')).toBeInTheDocument();
  });

  it('shows the on-device privacy note while awaiting a QR scan', () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    expect(screen.queryByAltText('scan.capture.exampleAlt')).toBeNull();
    expect(screen.getByText('scan.capture.privacy')).toBeInTheDocument();
  });

  it('moves to review with an empty scale field after a valid upload', async () => {
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    uploadSvg(RECT_SVG);

    // The field starts empty — the traced pixel extent is not a real-world
    // measurement, so the user must enter one. Add stays disabled until they do.
    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    expect((field as HTMLInputElement).value).toBe('');
    // Empty-but-untouched must not look like an error yet.
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('binDesigner.cutouts.scanImport.add')).toBeDisabled();
  });

  it('rescales and adds cutouts on confirm, then stays open for another scan', async () => {
    const onClose = vi.fn();
    render(<ScanWithPhoneDialog open onClose={onClose} />);
    uploadSvg(RECT_SVG);

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    fireEvent.change(field, { target: { value: '50' } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    expect(mockAddScanCutouts).toHaveBeenCalledOnce();
    const addedSpecs = mockAddScanCutouts.mock.calls[0][0] as Array<{ width: number }>;
    expect(addedSpecs[0].width).toBeCloseTo(50, 5);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText('binDesigner.cutouts.scanImport.added')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.done'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('skips scale-confirm and adds directly when the phone produced mm output', async () => {
    const onClose = vi.fn();
    render(<ScanWithPhoneDialog open onClose={onClose} />);
    uploadSvg(
      `<svg viewBox="0 0 100 100" data-scan-units="mm"><rect x="0" y="0" width="100" height="100"/></svg>`
    );

    await waitFor(() => expect(mockAddScanCutouts).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('binDesigner.cutouts.scanImport.scaleLabel')).toBeNull();
    expect(screen.getByText('binDesigner.cutouts.scanImport.added')).toBeInTheDocument();
  });

  it('buffers a scan that arrives during scale-confirm instead of clobbering it', async () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);

    // First pixel scan → scale-confirm.
    act(() => session.onSvg?.(RECT_SVG));
    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');

    // A second pixel scan arrives mid-confirm — it must not clobber the first.
    act(() =>
      session.onSvg?.('<svg viewBox="0 0 50 50"><rect x="0" y="0" width="50" height="50"/></svg>')
    );
    expect(mockAddScanCutouts).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '40' } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    // The first is added once; the buffered scan then drains into its own confirm.
    expect(mockAddScanCutouts).toHaveBeenCalledOnce();
    expect(
      await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel')
    ).toBeInTheDocument();
  });

  it('disables Add when the scale is non-positive', async () => {
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    uploadSvg(RECT_SVG);

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    fireEvent.change(field, { target: { value: '0' } });
    expect(screen.getByText('binDesigner.cutouts.scanImport.add')).toBeDisabled();
    // Once a non-positive value is typed, the field surfaces the error.
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('toasts an error when the upload is not a usable outline', async () => {
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    uploadSvg(`<svg viewBox="0 0 10 10"></svg>`);

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith('toast.scanImport.parseFailed', 'error')
    );
  });
});
