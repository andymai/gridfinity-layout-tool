import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EngineSelector } from './EngineSelector';
import { useLabsStore, useToastStore } from '@/core/store';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/analytics/posthog/trackEvent', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../FeatureStatusBadge', () => ({
  FeatureStatusBadge: ({ status }: { status: string }) => (
    <div data-testid="status-badge">{status}</div>
  ),
}));

function setBrepkitEnabled(brepkit: boolean) {
  useLabsStore.setState((prev) => ({
    preferences: {
      ...prev.preferences,
      enabledFeatures: {
        ...prev.preferences.enabledFeatures,
        brepkit_kernel: brepkit,
      },
      lastModified: new Date().toISOString(),
    },
  }));
}

function getSegment(label: string) {
  const button = screen.getByText(label).closest('button');
  if (!button) throw new Error(`Segment '${label}' not found`);
  return button;
}

describe('EngineSelector', () => {
  beforeEach(() => {
    resetAllStores();
    vi.mocked(trackEvent).mockClear();
  });

  it('marks Default (occt-wasm) as active when the brepkit flag is off', () => {
    render(<EngineSelector />);
    expect(getSegment('labs.engine.segmentDefault')).toHaveAttribute('aria-checked', 'true');
    expect(getSegment('labs.engine.segmentBrepkit')).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects BrepKit when brepkit_kernel is enabled', () => {
    setBrepkitEnabled(true);
    render(<EngineSelector />);
    expect(getSegment('labs.engine.segmentBrepkit')).toHaveAttribute('aria-checked', 'true');
    expect(getSegment('labs.engine.segmentDefault')).toHaveAttribute('aria-checked', 'false');
  });

  it('switching to BrepKit enables brepkit_kernel', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    expect(useLabsStore.getState().preferences.enabledFeatures.brepkit_kernel).toBe(true);
  });

  it('switching to Default clears the brepkit flag', () => {
    setBrepkitEnabled(true);
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    expect(useLabsStore.getState().preferences.enabledFeatures.brepkit_kernel).toBe(false);
  });

  it('emits a toast with a Reload action on each segment change', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.action?.label).toBe('labs.engine.reloadAction');
    expect(typeof toasts[0]?.action?.onClick).toBe('function');
  });

  it('tracks labs_engine_changed with from/to', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    expect(trackEvent).toHaveBeenCalledWith('labs_engine_changed', {
      from: 'default',
      to: 'brepkit',
    });
  });

  it('does not toast or track when clicking the already-active segment', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('replaces a prior reload toast instead of stacking on rapid switches', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe('labs.engine.reloadToast');
  });

  it('shows the experimental warning when BrepKit is selected', () => {
    setBrepkitEnabled(true);
    render(<EngineSelector />);
    expect(screen.getByText(/still in development/i)).toBeInTheDocument();
  });
});
