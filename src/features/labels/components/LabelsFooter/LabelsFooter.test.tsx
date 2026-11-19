import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import type { LabelsWorkspace } from '../../hooks/useLabelsWorkspace';
import { useLabelListStore } from '../../store/labelListStore';
import { LABEL_PRINTERS } from '../../utils/labelMedia';
import { LabelsFooter } from './LabelsFooter';

const initial = useLabelListStore.getState();
const printer = LABEL_PRINTERS['brother-pt'];

function workspace(overrides: Partial<LabelsWorkspace> = {}): LabelsWorkspace {
  return {
    printer,
    media: printer.media[2],
    measurer: {} as TypeMeasurer,
    plans: new Map(),
    fontsFailed: false,
    retryFonts: vi.fn(),
    hasEntries: true,
    skipped: 0,
    printable: 2,
    busy: false,
    download: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
});

describe('LabelsFooter', () => {
  it('downloads a ZIP for several labels and a PNG for one', async () => {
    const download = vi.fn(() => Promise.resolve());
    const { rerender } = render(<LabelsFooter workspace={workspace({ download })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download ZIP' }));
    expect(download).toHaveBeenCalled();

    rerender(<LabelsFooter workspace={workspace({ printable: 1 })} />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  it('cannot download while nothing is printable or a download runs', () => {
    const { rerender } = render(<LabelsFooter workspace={workspace({ printable: 0 })} />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();

    rerender(<LabelsFooter workspace={workspace({ busy: true })} />);
    expect(screen.getByRole('button', { name: /Download ZIP/ })).toBeDisabled();
  });

  it('counts the labels left out and offers a retry when the fonts failed', async () => {
    const retryFonts = vi.fn();
    render(<LabelsFooter workspace={workspace({ skipped: 2, fontsFailed: true, retryFonts })} />);

    expect(screen.getByText('Left out of the download: 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryFonts).toHaveBeenCalled();
  });

  it('clears the list after confirmation, and hides the button for an empty list', async () => {
    useLabelListStore.getState().addEntries([{ name: 'Nuts', detail: '' }]);
    const { rerender } = render(<LabelsFooter workspace={workspace()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear list' }));
    const confirm = screen.getByRole('dialog', { name: 'Clear list' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Clear list' }));
    expect(useLabelListStore.getState().entries).toEqual([]);

    rerender(<LabelsFooter workspace={workspace({ hasEntries: false })} />);
    expect(screen.queryByRole('button', { name: 'Clear list' })).toBeNull();
  });
});
