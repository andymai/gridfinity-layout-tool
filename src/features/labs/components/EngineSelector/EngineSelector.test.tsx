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

function setEnabled(brepkit: boolean, occt: boolean) {
  useLabsStore.setState((prev) => ({
    preferences: {
      ...prev.preferences,
      enabledFeatures: {
        ...prev.preferences.enabledFeatures,
        brepkit_kernel: brepkit,
        occt_wasm_kernel: occt,
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

  it('marks Default as active when neither flag is on', () => {
    render(<EngineSelector />);
    expect(getSegment('labs.engine.segmentDefault')).toHaveAttribute('aria-pressed', 'true');
    expect(getSegment('labs.engine.segmentOcctWasm')).toHaveAttribute('aria-pressed', 'false');
    expect(getSegment('labs.engine.segmentBrepkit')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects Updated OCCT when occt_wasm_kernel is enabled', () => {
    setEnabled(false, true);
    render(<EngineSelector />);
    expect(getSegment('labs.engine.segmentOcctWasm')).toHaveAttribute('aria-pressed', 'true');
  });

  it('prefers BrepKit when both flags are somehow on', () => {
    setEnabled(true, true);
    render(<EngineSelector />);
    expect(getSegment('labs.engine.segmentBrepkit')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching to BrepKit enables brepkit_kernel and disables occt_wasm_kernel', () => {
    setEnabled(false, true);
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    const flags = useLabsStore.getState().preferences.enabledFeatures;
    expect(flags.brepkit_kernel).toBe(true);
    expect(flags.occt_wasm_kernel).toBe(false);
  });

  it('switching to Default clears both kernel flags', () => {
    setEnabled(true, false);
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    const flags = useLabsStore.getState().preferences.enabledFeatures;
    expect(flags.brepkit_kernel).toBe(false);
    expect(flags.occt_wasm_kernel).toBe(false);
  });

  it('emits a toast with a Reload action on each segment change', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentOcctWasm'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.action?.label).toBe('labs.engine.reloadAction');
    expect(typeof toasts[0]?.action?.onClick).toBe('function');
  });

  it('tracks labs_engine_changed with from/to', () => {
    setEnabled(false, true);
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    expect(trackEvent).toHaveBeenCalledWith('labs_engine_changed', {
      from: 'occt-wasm',
      to: 'brepkit',
    });
  });

  it('does not toast or track when clicking the already-active segment', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('reconciles stale state when both flags are on and the displayed-active segment is clicked', () => {
    setEnabled(true, true);
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));

    const flags = useLabsStore.getState().preferences.enabledFeatures;
    expect(flags.brepkit_kernel).toBe(true);
    expect(flags.occt_wasm_kernel).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('replaces a prior reload toast instead of stacking on rapid switches', () => {
    render(<EngineSelector />);
    fireEvent.click(getSegment('labs.engine.segmentOcctWasm'));
    fireEvent.click(getSegment('labs.engine.segmentBrepkit'));
    fireEvent.click(getSegment('labs.engine.segmentDefault'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe('labs.engine.reloadToast');
  });

  it('shows the experimental warning when BrepKit is selected', () => {
    setEnabled(true, false);
    render(<EngineSelector />);
    expect(screen.getByText(/still in development/i)).toBeInTheDocument();
  });
});
