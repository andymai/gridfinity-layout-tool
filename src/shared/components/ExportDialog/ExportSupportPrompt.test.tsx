import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportSupportPrompt } from './ExportSupportPrompt';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

const trackEvent = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe('ExportSupportPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    trackEvent.mockClear();
  });

  it('confirms the download with the filename', () => {
    render(
      <ExportSupportPrompt fileName="my-bin.stl" onDone={vi.fn()} source="bin_designer_export" />
    );
    expect(screen.getByText(/my-bin\.stl/)).toBeInTheDocument();
  });

  it('opens Ko-fi and tracks the click with the source', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ExportSupportPrompt fileName="x.stl" onDone={vi.fn()} source="bin_designer_export" />);

    fireEvent.click(screen.getByText('header.supportOnKofi'));

    expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'bin_designer_export' });
    expect(openSpy).toHaveBeenCalledWith(
      'https://ko-fi.com/andyaragon',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('offers a free GitHub-star fallback that tracks the click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ExportSupportPrompt fileName="x.stl" onDone={vi.fn()} source="baseplate_export" />);

    fireEvent.click(screen.getByText('export.support.starGithub'));

    expect(trackEvent).toHaveBeenCalledWith('github_link_clicked', { source: 'baseplate_export' });
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/andymai/gridfinity-layout-tool',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('calls onDone when Done is clicked', () => {
    const onDone = vi.fn();
    render(<ExportSupportPrompt fileName="x.stl" onDone={onDone} source="bin_designer_export" />);

    fireEvent.click(screen.getByText('common.done'));

    expect(onDone).toHaveBeenCalledOnce();
  });
});
