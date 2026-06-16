import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerfOverlay } from './PerfOverlay';
import { useDesignerStore } from '@/features/bin-designer/store';
import { resetAllStores } from '@/test/testUtils';
import type { PerfSnapshot } from '@/shared/types/generation';

const enabled = vi.hoisted(() => ({ value: true }));
vi.mock('@/shared/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => enabled.value,
}));

const SNAPSHOT: PerfSnapshot = {
  totalMs: 1234,
  stages: [{ name: 'shell', ms: 800 }],
  featureBuilders: [],
  wallPatternSubsteps: [],
  hexCenterCount: 0,
  patternCutToolCount: 0,
};

describe('PerfOverlay', () => {
  beforeEach(() => {
    resetAllStores();
    enabled.value = true;
    useDesignerStore.getState().clearPerfHistory();
  });

  it('renders nothing when the labs flag is off', () => {
    enabled.value = false;
    useDesignerStore.getState().pushPerfSnapshot(SNAPSHOT);
    const { container } = render(<PerfOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there are no snapshots', () => {
    const { container } = render(<PerfOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the latest snapshot and clears history on demand', () => {
    useDesignerStore.getState().pushPerfSnapshot(SNAPSHOT);
    render(<PerfOverlay />);

    expect(screen.getByText('shell')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(useDesignerStore.getState().generation.perfHistory).toHaveLength(0);
  });
});
