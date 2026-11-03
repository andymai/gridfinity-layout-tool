import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PathPoint } from '@/shared/types/bin';
import { TraceExportMenu } from './TraceExportMenu';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const saving = vi.hoisted(() => ({
  deliver: vi.fn<(blob: Blob, name: string) => Promise<boolean>>(),
  track: vi.fn(),
}));
vi.mock('@/shared/exportDestination/deliverExport', () => ({ deliverExport: saving.deliver }));
vi.mock('@/shared/exportDestination/exportFolder', () => ({ primeExportFolder: vi.fn() }));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: saving.track }));

const pt = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});
const TOOLS = [{ path: [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)], holes: [] }];

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'scan.export.button.export' }));

describe('TraceExportMenu', () => {
  beforeEach(() => {
    saving.deliver.mockReset();
    saving.track.mockReset();
  });

  it('is disabled until there are tools to save', () => {
    render(<TraceExportMenu tools={null} source="trace_view" trigger="export" />);
    expect(screen.getByRole('button', { name: 'scan.export.button.export' })).toBeDisabled();
  });

  it('asks for a thickness only for an STL, and saves the file it names', async () => {
    saving.deliver.mockResolvedValue(true);
    render(<TraceExportMenu tools={TOOLS} source="phone" trigger="export" />);
    open();
    expect(screen.queryByText('scan.export.thickness')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'scan.export.format.stl' }));
    expect(screen.getByText('scan.export.thickness')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'scan.export.download.stl' }));
    await waitFor(() => expect(saving.deliver).toHaveBeenCalled());
    const [blob, name] = saving.deliver.mock.calls[0];
    expect(name).toBe('traced-tools.stl');
    expect(blob.type).toBe('model/stl');
    await waitFor(() =>
      expect(saving.track).toHaveBeenCalledWith('trace_export', {
        format: 'stl',
        clearance: false,
        tool_count: 1,
        source: 'phone',
      })
    );
    await waitFor(() => expect(screen.queryByText('scan.export.hint')).toBeNull());
  });

  it('stays open, and counts nothing, when the save is turned down', async () => {
    saving.deliver.mockResolvedValue(false);
    render(<TraceExportMenu tools={TOOLS} source="trace_view" trigger="export" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'scan.export.download.svg' }));
    await waitFor(() => expect(saving.deliver).toHaveBeenCalled());
    expect(saving.track).not.toHaveBeenCalled();
    expect(screen.getByText('scan.export.hint')).toBeInTheDocument();
  });

  it('says so when the file cannot be made', async () => {
    saving.deliver.mockRejectedValue(new Error('disk full'));
    render(<TraceExportMenu tools={TOOLS} source="trace_view" trigger="export" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'scan.export.download.svg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('scan.export.failed');
  });
});
