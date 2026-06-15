import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StackSampleButton } from './StackSampleButton';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string): string =>
      key,
}));

const downloadSample = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../hooks/useStackSampleExport', () => ({
  STACK_SAMPLE_BASE_NAME: 'stack-fit-sample',
  useStackSampleExport: () => ({ isExporting: false, canExport, downloadSample }),
}));

describe('StackSampleButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadSample.mockClear();
    canExport = true;
  });

  it('opens the export dialog when clicked', () => {
    render(<StackSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.stackPrint.sampleButton' }));
    expect(screen.getByText('baseplate.stackPrint.sampleTitle')).toBeInTheDocument();
  });

  it('triggers an STL sample download with the default name', async () => {
    render(<StackSampleButton />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.stackPrint.sampleButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'export.downloadFormat' }));
    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('stl', 'stack-fit-sample'));
  });

  it('disables the trigger when export is unavailable', () => {
    canExport = false;
    render(<StackSampleButton />);
    expect(
      screen.getByRole('button', { name: 'baseplate.stackPrint.sampleButton' })
    ).toBeDisabled();
  });
});
