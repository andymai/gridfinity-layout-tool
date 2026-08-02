import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LabelFitSampleButton } from './LabelFitSampleButton';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const downloadSample = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../../hooks/useLabelFitSampleExport', () => ({
  LABEL_FIT_SAMPLE_BASE_NAME: 'label-fit-sample',
  useLabelFitSampleExport: () => ({ isExporting: false, canExport, downloadSample }),
}));

describe('LabelFitSampleButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadSample.mockClear();
    canExport = true;
  });

  it('opens the export dialog with usage tips when clicked', () => {
    render(<LabelFitSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.fitSample.button' }));

    expect(screen.getByText('binDesigner.fitSample.dialogTitle')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.fitSample.tipsTitle')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.fitSample.tip1')).toBeInTheDocument();
  });

  it('triggers a STL card download with the default name from the dialog', async () => {
    render(<LabelFitSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.fitSample.button' }));
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'label-fit-sample'));
  });

  it('forwards a custom filename to the download', async () => {
    render(<LabelFitSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.fitSample.button' }));
    fireEvent.click(screen.getByRole('button', { name: 'export.nameStyle.custom' }));
    fireEvent.change(screen.getByLabelText('export.customFileName'), {
      target: { value: 'my-card' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'my-card'));
  });

  it('disables the trigger when export is unavailable', () => {
    canExport = false;
    render(<LabelFitSampleButton />);

    expect(screen.getByRole('button', { name: 'binDesigner.fitSample.button' })).toBeDisabled();
  });
});
