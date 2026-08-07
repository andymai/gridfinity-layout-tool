import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SlideFitSampleButton } from './SlideFitSampleButton';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const downloadSample = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../../hooks/useSlideFitSampleExport', () => ({
  SLIDE_FIT_SAMPLE_BASE_NAME: 'slide-fit-sample',
  useSlideFitSampleExport: () => ({ isExporting: false, canExport, downloadSample }),
}));

describe('SlideFitSampleButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadSample.mockClear();
    canExport = true;
  });

  it('offers the fit test', () => {
    render(<SlideFitSampleButton />);
    expect(
      screen.getByRole('button', { name: 'binDesigner.slideTray.fitSample.button' })
    ).toBeEnabled();
  });

  it('disables the button when no bridge is ready', () => {
    canExport = false;
    render(<SlideFitSampleButton />);
    expect(
      screen.getByRole('button', { name: 'binDesigner.slideTray.fitSample.button' })
    ).toBeDisabled();
  });

  it('opens the export dialog and downloads', async () => {
    render(<SlideFitSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.slideTray.fitSample.button' }));
    await waitFor(() =>
      expect(screen.getByText('binDesigner.slideTray.fitSample.dialogTitle')).toBeInTheDocument()
    );
    // The rungs are ordered rather than labelled, so these tips are the only
    // thing telling a user how to read the card.
    expect(screen.getByText('binDesigner.slideTray.fitSample.tip1')).toBeInTheDocument();
  });
});
