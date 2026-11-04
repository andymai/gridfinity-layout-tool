import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { trackEvent } from '@/shared/analytics/posthog';
import { ScanToolDialog } from './ScanToolDialog';

vi.mock('@/shared/exportDestination/deliverExport', () => ({
  deliverExport: vi.fn(async () => true),
}));

const mockAddScanCutouts = vi.fn((..._args: unknown[]) => 1);
vi.mock('./useScanImport', () => ({
  useScanImport: () => ({ addScanCutouts: mockAddScanCutouts }),
}));

// Keep the cross-device session out of these tests (no network / QR import).
// A mutable hoisted handle lets tests drive the live "waiting for QR scan"
// branch and see whether the dialog asked for a session.
const session = vi.hoisted(() => ({
  current: { phase: 'unavailable', url: null as string | null },
  onSvg: null as ((svg: string) => void) | null,
  active: false,
  attempt: 0,
}));
vi.mock('./useScanSession', () => ({
  useScanSession: (active: boolean, onSvg: (svg: string) => void, attempt = 0) => {
    session.active = active;
    session.attempt = attempt;
    session.onSvg = onSvg;
    return active ? session.current : { phase: 'idle', url: null };
  },
}));

const trace = vi.hoisted(() => ({ onTraced: null as ((svg: string) => void) | null }));
vi.mock('../../../TraceView/TraceView', () => ({
  TraceView: ({ onTraced }: { onTraced: (svg: string) => void }) => {
    trace.onTraced = onTraced;
    return <p>trace view</p>;
  },
}));

const mockAddToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

const RECT_SVG = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>`;

function choosePhone(): void {
  fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.routePhone'));
}

function uploadSvg(svg: string): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([svg], 'scan.svg', { type: 'image/svg+xml' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ScanToolDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = { phase: 'unavailable', url: null };
    session.active = false;
    session.attempt = 0;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('reports where it was opened from, once per opening', () => {
    const { rerender } = render(<ScanToolDialog open={false} source="header" onClose={vi.fn()} />);
    expect(trackEvent).not.toHaveBeenCalledWith('scan_opened', expect.anything());

    rerender(<ScanToolDialog open source="header" onClose={vi.fn()} />);
    rerender(<ScanToolDialog open source="header" onClose={vi.fn()} />);
    expect(trackEvent).toHaveBeenCalledWith('scan_opened', { source: 'header' });
    expect(vi.mocked(trackEvent).mock.calls.filter(([e]) => e === 'scan_opened')).toHaveLength(1);
  });

  it('opens on the two routes without starting a phone session', () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.routePhone')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.traceView.open')).toBeInTheDocument();
    expect(session.active).toBe(false);
  });

  it('keeps the phone session alive after going back to the routes', () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();
    expect(session.active).toBe(true);
    expect(screen.getByText('https://example.com/scan/abc')).toBeInTheDocument();

    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.back'));
    expect(screen.getByText('binDesigner.cutouts.scanImport.routePhone')).toBeInTheDocument();
    expect(session.active).toBe(true);
  });

  it('retries a dead phone session when the phone route is picked again', () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();
    expect(session.attempt).toBe(0);

    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.back'));
    choosePhone();
    expect(session.attempt).toBe(1);
  });

  it('keeps keyboard focus inside the dialog across route changes', () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();
    expect(document.activeElement).toBe(
      screen.getByText('binDesigner.cutouts.scanImport.back').closest('button')
    );

    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.back'));
    expect(document.activeElement).toBe(
      screen.getByText('binDesigner.cutouts.scanImport.routePhone').closest('button')
    );
  });

  it('says when phone scanning is unavailable, behind the phone route', () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    expect(screen.queryByText('binDesigner.cutouts.scanImport.unavailable')).toBeNull();
    choosePhone();
    expect(screen.getByText('binDesigner.cutouts.scanImport.unavailable')).toBeInTheDocument();
  });

  it('adds what a photo traced on this computer, as a desktop trace', async () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.open'));
    await screen.findByText('trace view');

    act(() =>
      trace.onTraced?.(
        '<svg viewBox="0 0 50 30" data-scan-units="mm"><path d="M 0 0 L 50 0 L 50 30 L 0 30 Z"/></svg>'
      )
    );

    expect(mockAddScanCutouts).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(
      'scan_import',
      expect.objectContaining({ success: true, source: 'desktop_trace' })
    );
  });

  it('shows the upload affordance in the awaiting state', () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.upload')).toBeInTheDocument();
  });

  it('shows the on-device privacy note while awaiting a QR scan', () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();
    expect(screen.queryByAltText('scan.capture.exampleAlt')).toBeNull();
    expect(screen.getByText('scan.capture.privacy')).toBeInTheDocument();
  });

  // The sheet is printed on the computer, not the phone, so the offer lives
  // beside the QR code rather than on the capture page.
  it('downloads the calibration sheet from the awaiting state', () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();

    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.calibrationSheet'));

    expect(deliverExport).toHaveBeenCalledTimes(1);
    expect(deliverExport).toHaveBeenCalledWith(
      expect.any(Blob),
      'gridfinity-calibration-sheet.svg'
    );
  });

  it('moves to review with an empty scale field after a valid upload', async () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
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
    render(<ScanToolDialog open source="toolbar" onClose={onClose} />);
    uploadSvg(RECT_SVG);

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    fireEvent.change(field, { target: { value: '50' } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    expect(mockAddScanCutouts).toHaveBeenCalledOnce();
    const addedSpecs = mockAddScanCutouts.mock.calls[0][0] as Array<{ width: number }>;
    expect(addedSpecs[0].width).toBeCloseTo(50, 5);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText('binDesigner.cutouts.scanImport.added.one')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.done'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('asks for the longest tool’s length when an unscaled scan holds several', async () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    uploadSvg(
      '<svg viewBox="0 0 300 100"><rect x="0" y="0" width="120" height="40"/>' +
        '<rect x="200" y="0" width="30" height="90"/></svg>'
    );

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabelLongest');
    fireEvent.change(field, { target: { value: '60' } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    const addedSpecs = mockAddScanCutouts.mock.calls[0][0] as Array<{ width: number }>;
    expect(Math.max(...addedSpecs.map((s) => s.width))).toBeCloseTo(60, 5);
  });

  it('skips scale-confirm and adds directly when the phone produced mm output', async () => {
    const onClose = vi.fn();
    render(<ScanToolDialog open source="toolbar" onClose={onClose} />);
    uploadSvg(
      `<svg viewBox="0 0 100 100" data-scan-units="mm"><rect x="0" y="0" width="100" height="100"/></svg>`
    );

    await waitFor(() => expect(mockAddScanCutouts).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('binDesigner.cutouts.scanImport.scaleLabel')).toBeNull();
    expect(screen.getByText('binDesigner.cutouts.scanImport.added.one')).toBeInTheDocument();
  });

  it('buffers a scan that arrives during scale-confirm instead of clobbering it', async () => {
    session.current = { phase: 'waiting', url: 'https://example.com/scan/abc' };
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    choosePhone();

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
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    uploadSvg(RECT_SVG);

    const field = await screen.findByLabelText('binDesigner.cutouts.scanImport.scaleLabel');
    fireEvent.change(field, { target: { value: '0' } });
    expect(screen.getByText('binDesigner.cutouts.scanImport.add')).toBeDisabled();
    // Once a non-positive value is typed, the field surfaces the error.
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('toasts an error when the upload is not a usable outline', async () => {
    render(<ScanToolDialog open source="toolbar" onClose={vi.fn()} />);
    uploadSvg(`<svg viewBox="0 0 10 10"></svg>`);

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith('toast.scanImport.parseFailed', 'error')
    );
  });
});
