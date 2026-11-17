import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadTestTypeMeasurer } from '@/test/testTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { useToastStore } from '@/core/store';
import { useLabelListStore } from '../../store/labelListStore';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT } from '../../utils/planLabel';
import { LabelsDialog } from './LabelsDialog';

const mocks = vi.hoisted(() => ({
  measurer: null as TypeMeasurer | null,
  downloadLabels: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('@/shared/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => mocks.measurer,
}));
vi.mock('../../utils/downloadLabels', () => ({ downloadLabels: mocks.downloadLabels }));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: mocks.trackEvent }));

const initial = useLabelListStore.getState();

beforeAll(async () => {
  mocks.measurer = await loadTestTypeMeasurer([LABEL_NAME_FONT, LABEL_DETAIL_FONT]);
});

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
  mocks.downloadLabels.mockReset();
  mocks.trackEvent.mockReset();
});

describe('LabelsDialog', () => {
  it('cannot download an empty list', () => {
    render(<LabelsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });

  it('downloads the list as a ZIP for the chosen printer and records it', async () => {
    useLabelListStore.getState().addEntries([
      { name: 'Socket head screw', detail: '91290A113' },
      { name: 'Hex nut', detail: '90592A085' },
    ]);
    mocks.downloadLabels.mockResolvedValue(2);
    render(<LabelsDialog open onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download ZIP' }));

    const [entries, plans, , printer, media] = mocks.downloadLabels.mock.calls[0] as [
      unknown[],
      Map<string, { fits: boolean }>,
      unknown,
      { id: string },
      { id: string },
    ];
    expect(entries).toHaveLength(2);
    expect([...plans.values()].every((plan) => plan.fits)).toBe(true);
    expect(printer.id).toBe('brother-pt');
    expect(media.id).toBe('12');
    expect(mocks.trackEvent).toHaveBeenCalledWith('labels_downloaded', {
      printer: 'brother-pt',
      media: '12',
      labels: 2,
    });
  });

  it('shows an error when the labels cannot be made', async () => {
    useLabelListStore.getState().addEntries([{ name: 'Nuts', detail: '' }]);
    mocks.downloadLabels.mockRejectedValue(new Error('no canvas'));
    const addToast = vi.spyOn(useToastStore.getState(), 'addToast');
    render(<LabelsDialog open onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(addToast).toHaveBeenCalledWith('The labels could not be made. Try again.', 'error');
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it('counts labels too long to print and leaves them out of the download count', () => {
    useLabelListStore.getState().setPrinter('brother-pt', '6');
    useLabelListStore.getState().setTapeLength(1);
    useLabelListStore.getState().addEntries([
      { name: 'Nuts', detail: '' },
      {
        name: 'Black-oxide alloy steel socket head screws for the left drawer, with a long name',
        detail: '',
      },
    ]);
    render(<LabelsDialog open onClose={vi.fn()} />);

    expect(screen.getByText('Too long to print: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  it('clears the list after confirmation', async () => {
    useLabelListStore.getState().addEntries([{ name: 'Nuts', detail: '' }]);
    render(<LabelsDialog open onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear list' }));
    const confirm = screen.getByRole('dialog', { name: 'Clear list' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Clear list' }));

    expect(useLabelListStore.getState().entries).toEqual([]);
  });
});
