import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DividerFitSampleButton } from './DividerFitSampleButton';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const downloadSample = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../hooks/useDividerFitSampleExport', () => ({
  DIVIDER_FIT_SAMPLE_BASE_NAME: 'divider-fit-sample',
  useDividerFitSampleExport: () => ({ isExporting: false, canExport, downloadSample }),
}));

describe('DividerFitSampleButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadSample.mockClear();
    canExport = true;
  });

  it('offers the fit test', () => {
    render(<DividerFitSampleButton />);
    expect(
      screen.getByRole('button', { name: 'binDesigner.dividerFitSample.button' })
    ).toBeEnabled();
  });

  it('disables the button when there is nothing to export', () => {
    canExport = false;
    render(<DividerFitSampleButton />);
    expect(
      screen.getByRole('button', { name: 'binDesigner.dividerFitSample.button' })
    ).toBeDisabled();
  });

  it('opens the export dialog with the steps to read it, and downloads', async () => {
    render(<DividerFitSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.dividerFitSample.button' }));
    await waitFor(() =>
      expect(screen.getByText('binDesigner.dividerFitSample.dialogTitle')).toBeInTheDocument()
    );
    for (const tip of ['tip1', 'tip2', 'tip3']) {
      expect(screen.getByText(`binDesigner.dividerFitSample.${tip}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'divider-fit-sample'));
  });
});
