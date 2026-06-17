import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScanWithPhoneDialog } from './ScanWithPhoneDialog';

const mockAddScanCutouts = vi.fn(() => 1);
vi.mock('./useScanImport', () => ({
  useScanImport: () => ({ addScanCutouts: mockAddScanCutouts }),
}));

// Keep the cross-device session out of these tests (no network / QR import);
// the awaiting state falls back to the manual-upload affordance.
vi.mock('./useScanSession', () => ({
  useScanSession: () => ({ phase: 'unavailable', url: null }),
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
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the upload affordance in the awaiting state', () => {
    render(<ScanWithPhoneDialog open onClose={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.upload')).toBeInTheDocument();
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

  it('rescales and adds cutouts on confirm, then closes', async () => {
    const onClose = vi.fn();
    render(<ScanWithPhoneDialog open onClose={onClose} />);
    uploadSvg(RECT_SVG);

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    fireEvent.change(field, { target: { value: '50' } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    expect(mockAddScanCutouts).toHaveBeenCalledOnce();
    const addedSpecs = mockAddScanCutouts.mock.calls[0][0] as Array<{ width: number }>;
    expect(addedSpecs[0].width).toBeCloseTo(50, 5);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('skips scale-confirm and adds directly when the phone produced mm output', async () => {
    const onClose = vi.fn();
    render(<ScanWithPhoneDialog open onClose={onClose} />);
    uploadSvg(
      `<svg viewBox="0 0 100 100" data-scan-units="mm"><rect x="0" y="0" width="100" height="100"/></svg>`
    );

    await waitFor(() => expect(mockAddScanCutouts).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    // No scale-confirm step is shown.
    expect(screen.queryByLabelText('binDesigner.cutouts.scanImport.scaleLabel')).toBeNull();
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
