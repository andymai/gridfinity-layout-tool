// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { INITIAL_TOAST_STATE, useToastStore } from '@/core/store/toast';
import { ReportDialog } from './ReportDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../../api/client', () => ({
  reportDesign: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { reportDesign } from '../../api/client';
import { trackEvent } from '@/shared/analytics/posthog';

const reportMock = vi.mocked(reportDesign);

function renderDialog(overrides: Partial<Parameters<typeof ReportDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onNeedsAuth = vi.fn();
  render(
    <ReportDialog
      designId="abc123def456"
      onClose={onClose}
      onNeedsAuth={onNeedsAuth}
      {...overrides}
    />
  );
  return { onClose, onNeedsAuth };
}

describe('ReportDialog', () => {
  beforeEach(() => {
    reportMock.mockReset();
    vi.mocked(trackEvent).mockReset();
    useToastStore.setState({ ...INITIAL_TOAST_STATE });
  });

  it('renders the closed reason union as a radiogroup', () => {
    renderDialog();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByText('community.report.reason.inappropriate')).toBeInTheDocument();
    expect(screen.getByText('community.report.reason.spam')).toBeInTheDocument();
    expect(screen.getByText('community.report.reason.broken')).toBeInTheDocument();
    expect(screen.getByText('community.report.reason.stolen')).toBeInTheDocument();
  });

  it('requires a reason: submit stays disabled until one is selected', () => {
    renderDialog();
    const submit = screen.getByRole('button', { name: 'community.report.submit' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByText('community.report.reason.spam'));
    expect(
      screen.getByText('community.report.reason.spam').closest('[role="radio"]')
    ).toHaveAttribute('aria-checked', 'true');
    expect(submit).toBeEnabled();
  });

  it('caps the optional note at 500 characters', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('community.report.notePlaceholder')).toHaveAttribute(
      'maxlength',
      '500'
    );
  });

  it('submits reason + note, toasts, tracks, and closes', async () => {
    reportMock.mockResolvedValue(ok({ success: true }));
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByText('community.report.reason.broken'));
    fireEvent.change(screen.getByPlaceholderText('community.report.notePlaceholder'), {
      target: { value: 'The lid does not export' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.report.submit' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(reportMock).toHaveBeenCalledWith('abc123def456', 'broken', 'The lid does not export');
    expect(trackEvent).toHaveBeenCalledWith('community_report', { reason: 'broken' });
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'community.report.submitted'
    );
  });

  it('hands a stale session to onNeedsAuth instead of erroring inline', async () => {
    reportMock.mockResolvedValue(err({ kind: 'needsAuth' }));
    const { onClose, onNeedsAuth } = renderDialog();

    fireEvent.click(screen.getByText('community.report.reason.spam'));
    fireEvent.click(screen.getByRole('button', { name: 'community.report.submit' }));

    await waitFor(() => {
      expect(onNeedsAuth).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows an inline error and stays open on server failure', async () => {
    reportMock.mockResolvedValue(err({ kind: 'server' }));
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByText('community.report.reason.spam'));
    fireEvent.click(screen.getByRole('button', { name: 'community.report.submit' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('community.report.error.generic');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('moves the selection with arrow keys per the radio keyboard model', () => {
    renderDialog();
    fireEvent.click(screen.getByText('community.report.reason.inappropriate'));
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
    expect(
      screen.getByText('community.report.reason.spam').closest('[role="radio"]')
    ).toHaveAttribute('aria-checked', 'true');
  });
});
