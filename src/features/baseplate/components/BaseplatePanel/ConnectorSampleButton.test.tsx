import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectorSampleButton } from './ConnectorSampleButton';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string): string =>
      key,
}));

const downloadSample = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../hooks/useConnectorSampleExport', () => ({
  CONNECTOR_SAMPLE_BASE_NAME: 'connector-fit-sample',
  useConnectorSampleExport: () => ({ isExporting: false, canExport, downloadSample }),
}));

describe('ConnectorSampleButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadSample.mockClear();
    canExport = true;
  });

  it('opens the export dialog with print tips when clicked', () => {
    render(<ConnectorSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.connectorSample.button' }));

    expect(screen.getByText('baseplate.connectorSample.dialogTitle')).toBeInTheDocument();
    expect(screen.getByText('baseplate.connectorSample.tipsTitle')).toBeInTheDocument();
    expect(screen.getByText('baseplate.connectorSample.tip1')).toBeInTheDocument();
  });

  it('triggers a STL sample download with the default name from the dialog', async () => {
    render(<ConnectorSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.connectorSample.button' }));
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'connector-fit-sample'));
  });

  it('forwards a custom filename to the download', async () => {
    render(<ConnectorSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.connectorSample.button' }));
    // Switch to custom naming and type a name.
    fireEvent.click(screen.getByRole('button', { name: 'export.nameStyle.custom' }));
    fireEvent.change(screen.getByLabelText('export.customFileName'), {
      target: { value: 'my-card' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'my-card'));
  });

  it('disables the trigger when export is unavailable', () => {
    canExport = false;
    render(<ConnectorSampleButton />);
    expect(screen.getByRole('button', { name: 'baseplate.connectorSample.button' })).toBeDisabled();
  });
});
