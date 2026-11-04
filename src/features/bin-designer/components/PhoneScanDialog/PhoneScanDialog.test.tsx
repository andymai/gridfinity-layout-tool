import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout } from '@/features/bin-designer/types';
import { trackEvent } from '@/shared/analytics/posthog';
import type * as ScanImport from '../panel/CutoutsSection/scanImport';
import type { ScanUseOutcome } from '@/shared/scanReview/components/ScanCaptureFlow';
import { PhoneScanDialog } from './PhoneScanDialog';

const flow = vi.hoisted(() => ({
  onUse: null as ((svg: string, count: number) => Promise<ScanUseOutcome>) | null,
}));
vi.mock('@/shared/scanReview/components/ScanCaptureFlow', () => ({
  ScanCaptureFlow: ({ onUse }: { onUse: typeof flow.onUse }) => {
    flow.onUse = onUse;
    return <p>capture flow</p>;
  },
}));

const mockAdd = vi.hoisted(() => vi.fn((..._args: unknown[]) => 1));
vi.mock('../panel/CutoutsSection/scanImport', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanImport>()),
  useScanImport: () => ({ addScanCutouts: mockAdd }),
}));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const MM_SVG =
  '<svg viewBox="0 0 120 40" data-scan-units="mm"><path d="M 0 0 L 120 0 L 120 40 L 0 40 Z"/></svg>';
const PX_SVG = '<svg viewBox="0 0 200 100"><rect x="0" y="0" width="200" height="100"/></svg>';

async function openFlow(): Promise<NonNullable<typeof flow.onUse>> {
  act(() => useDesignerStore.getState().openPhoneScan('card'));
  render(<PhoneScanDialog />);
  await screen.findByText('capture flow');
  if (!flow.onUse) throw new Error('flow not mounted');
  return flow.onUse;
}

describe('PhoneScanDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flow.onUse = null;
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useToastStore.setState({ toasts: [] });
    mockAdd.mockImplementation(() => 1);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('packs a scan that came out in millimetres into the bin, then closes', async () => {
    const use = await openFlow();
    expect(trackEvent).toHaveBeenCalledWith('scan_opened', { source: 'card' });

    let outcome: ScanUseOutcome | undefined;
    await act(async () => {
      outcome = await use(MM_SVG, 1);
    });

    expect(outcome).toEqual({ kind: 'taken' });
    expect(mockAdd).toHaveBeenCalledWith(expect.any(Array), undefined, { pack: true });
    expect(useDesignerStore.getState().ui.phoneScanSource).toBeNull();
  });

  it('asks for one real measurement before adding a pixel scan', async () => {
    const use = await openFlow();
    await act(async () => {
      await use(PX_SVG, 1);
    });
    expect(mockAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.scanImport.scaleLabel'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByText('binDesigner.cutouts.scanImport.add'));

    const [specs, , options] = mockAdd.mock.calls[0] as [
      Array<{ width: number }>,
      unknown,
      unknown,
    ];
    expect(specs[0].width).toBeCloseTo(50, 5);
    expect(options).toEqual({ pack: true });
  });

  it('opens on the bin, with the panel on Interior for when it closes', async () => {
    useDesignerStore.setState((s) => ({
      ui: { ...s.ui, cutoutTarget: 'lid', activeCategory: 'shape' },
    }));
    await openFlow();
    expect(useDesignerStore.getState().ui.cutoutTarget).toBe('bin');
    expect(useDesignerStore.getState().ui.activeCategory).toBe('interior');
  });

  it('starts each pixel scan without the last one’s measurement', async () => {
    const use = await openFlow();
    await act(async () => {
      await use(PX_SVG, 1);
    });
    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.scanImport.scaleLabel'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByText('scan.retake'));

    const again = await screen.findByText('capture flow').then(() => flow.onUse);
    if (!again) throw new Error('flow not remounted');
    await act(async () => {
      await again(PX_SVG, 1);
    });
    expect(screen.getByLabelText('binDesigner.cutouts.scanImport.scaleLabel')).toHaveValue(null);
    expect(screen.getByText('binDesigner.cutouts.scanImport.add').closest('button')).toBeDisabled();
  });

  it('says so when a packed tool still does not fit the bin', async () => {
    const stranded: Cutout = {
      id: 'too-long',
      shape: 'rectangle',
      x: 2,
      y: 2,
      width: 900,
      depth: 20,
      cutDepth: 10,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
    mockAdd.mockImplementation(() => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, style: 'solid', cutouts: [stranded] },
      });
      return 1;
    });
    const use = await openFlow();
    await act(async () => {
      await use(MM_SVG, 1);
    });

    const [toast] = useToastStore.getState().toasts;
    expect(toast.message).toBe('toast.scanImport.offFloor');
    expect(toast.type).toBe('info');
  });

  it('turns an unreadable outline back to the flow as an error', async () => {
    const use = await openFlow();
    let outcome: ScanUseOutcome | undefined;
    await act(async () => {
      outcome = await use('<svg viewBox="0 0 10 10"></svg>', 1);
    });
    expect(outcome).toEqual({ kind: 'error', messageKey: 'toast.scanImport.parseFailed' });
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
