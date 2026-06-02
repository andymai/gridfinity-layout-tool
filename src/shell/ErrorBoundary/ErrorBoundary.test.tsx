import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  track3DRenderError: vi.fn(),
}));

// Mock storage: the boundary now offers a non-destructive backup, not a wipe.
vi.mock('@/core/storage', () => ({
  downloadArchive: vi.fn().mockResolvedValue({ json: '{}', layoutCount: 0 }),
}));

// Mock the library store the boundary reads imperatively.
vi.mock('@/core/store/library', () => ({
  useLibraryStore: { getState: () => ({ library: { entries: [], folders: [] } }) },
}));

// Mock getStaticTranslation since it's not a hook
vi.mock('@/i18n', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    getStaticTranslation: (key: string) => {
      const translations: Record<string, string> = {
        'errorBoundary.heading': 'Something went wrong',
        'errorBoundary.description': 'An unexpected error occurred.',
        'errorBoundary.hint': 'Try again or download a backup.',
        'errorBoundary.tryAgain': 'Try Again',
        'errorBoundary.downloadBackup': 'Download Backup',
        'errorBoundary.backupError': "Couldn't create a backup.",
      };
      return translations[key] ?? key;
    },
  };
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays the error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    let shouldThrow = true;
    const DynamicChild = () => {
      if (shouldThrow) throw new Error('Test error');
      return <div>Child content</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    rerender(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('offers a non-destructive backup instead of a reset', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Download Backup')).toBeInTheDocument();
    // The destructive wipe must not be reachable from the crash screen.
    expect(screen.queryByText(/reset app data/i)).not.toBeInTheDocument();
  });

  it('downloads a backup archive on Download Backup click', async () => {
    const { downloadArchive } = await import('@/core/storage');
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Download Backup'));
    expect(downloadArchive).toHaveBeenCalled();
  });

  it('shows an error message when the backup fails', async () => {
    const { downloadArchive } = await import('@/core/storage');
    vi.mocked(downloadArchive).mockRejectedValueOnce(new Error('export failed'));

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Download Backup'));
    await vi.waitFor(() =>
      expect(screen.getByText("Couldn't create a backup.")).toBeInTheDocument()
    );
  });

  it('has aria-live assertive on error fallback for screen readers', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
