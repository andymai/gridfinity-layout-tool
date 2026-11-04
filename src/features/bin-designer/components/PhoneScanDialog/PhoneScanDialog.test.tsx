import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
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
