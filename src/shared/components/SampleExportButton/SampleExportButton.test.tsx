import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useToastStore } from '@/core/store/toast';
import { SampleExportButton } from './SampleExportButton';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function renderButton(overrides: Partial<Parameters<typeof SampleExportButton>[0]> = {}) {
  const downloadSample = vi.fn().mockResolvedValue(true);
  render(
    <SampleExportButton
      isExporting={false}
      canExport
      downloadSample={downloadSample}
      defaultBaseName="my-sample"
      label="Print sample"
      dialogTitle="Sample title"
      dialogDescription="Sample description"
      exportCompleteMessage="Sample saved"
      tips={{ title: 'Tips', items: ['first tip', 'second tip'] }}
      {...overrides}
    />
  );
  return { downloadSample };
}

describe('SampleExportButton', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('opens the dialog with the tips and downloads under the default name', async () => {
    const { downloadSample } = renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Print sample' }));
    expect(screen.getByText('Sample title')).toBeInTheDocument();
    expect(screen.getByText('Tips')).toBeInTheDocument();
    expect(screen.getByText('second tip')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'my-sample'));
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('Sample saved'));
    expect(screen.queryByText('Sample title')).not.toBeInTheDocument();
  });

  it('stays open and quiet when the download reports failure', async () => {
    const { downloadSample } = renderButton();
    downloadSample.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Print sample' }));
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));

    await waitFor(() => expect(downloadSample).toHaveBeenCalled());
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(screen.getByText('Sample title')).toBeInTheDocument();
  });

  it('disables the trigger when nothing can export', () => {
    renderButton({ canExport: false });
    expect(screen.getByRole('button', { name: 'Print sample' })).toBeDisabled();
  });
});
