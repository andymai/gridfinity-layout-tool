import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { captureException } from '@/shared/analytics/posthog';
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';
import { BackgroundMountBoundary } from './BackgroundMountBoundary';
import type * as StaleRecovery from '@/shared/pwa/staleRecovery';

vi.mock('@/shared/analytics/posthog', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/shared/pwa/staleRecovery', async (importOriginal) => ({
  ...(await importOriginal<typeof StaleRecovery>()),
  recoverStaleBundle: vi.fn().mockResolvedValue(true),
}));

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('error loading dynamically imported module: /assets/x.js');
  return <div>side effect ran</div>;
}

describe('BackgroundMountBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when the mount loads', () => {
    render(
      <BackgroundMountBoundary mountName="BaseplateLibraryInitMount">
        <ThrowingChild shouldThrow={false} />
      </BackgroundMountBoundary>
    );
    expect(screen.getByText('side effect ran')).toBeInTheDocument();
  });

  it('renders nothing when the chunk fails, rather than propagating to the root', () => {
    const { container } = render(
      <BackgroundMountBoundary mountName="BaseplateLibraryInitMount">
        <ThrowingChild shouldThrow={true} />
      </BackgroundMountBoundary>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the surrounding app mounted', () => {
    render(
      <div>
        <BackgroundMountBoundary mountName="SyncSessionMount">
          <ThrowingChild shouldThrow={true} />
        </BackgroundMountBoundary>
        <span>app still here</span>
      </div>
    );
    expect(screen.getByText('app still here')).toBeInTheDocument();
  });

  it('reports under its own boundary tag so it is not read as a root crash', () => {
    render(
      <BackgroundMountBoundary mountName="SharedLayoutImporter">
        <ThrowingChild shouldThrow={true} />
      </BackgroundMountBoundary>
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ boundary: 'background-mount', mountName: 'SharedLayoutImporter' })
    );
  });

  it('starts a stale-bundle recovery for a chunk miss, which renders nothing to recover from', () => {
    render(
      <BackgroundMountBoundary mountName="SharedLayoutImporter">
        <ThrowingChild shouldThrow={true} />
      </BackgroundMountBoundary>
    );
    expect(recoverStaleBundle).toHaveBeenCalledWith('background_mount_chunk_load');
  });

  it('does not start a recovery for an error that is not a chunk miss', () => {
    function FaultyChild(): never {
      throw new Error('boom');
    }
    render(
      <BackgroundMountBoundary mountName="SyncSessionMount">
        <FaultyChild />
      </BackgroundMountBoundary>
    );
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });
});
