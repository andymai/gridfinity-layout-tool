import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const { undoMock, historyState } = vi.hoisted(() => ({
  undoMock: vi.fn(),
  historyState: { canUndo: true },
}));

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  track3DRenderError: vi.fn(),
}));

// Mock storage: the boundary now offers a non-destructive backup, not a wipe.
// Mock resolves with the real ExportResult shape ({ json, exported, skipped }).
vi.mock('@/core/storage', () => ({
  downloadArchive: vi.fn().mockResolvedValue({ json: '{}', exported: 0, skipped: 0 }),
}));

// Mock the library store the boundary reads imperatively. Minimal but
// correctly-shaped LayoutLibrary to avoid drift from the real type.
vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      library: { version: '1.0', activeLayoutId: 'test-layout', settings: {}, entries: [] },
    }),
  },
}));

// Mock the undo history store. `historyState.canUndo` is mutable per test.
vi.mock('@/core/cqrs/undo/historyStore', () => ({
  useHistoryStore: { getState: () => ({ canUndo: historyState.canUndo, undo: undoMock }) },
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
        'errorBoundary.undoLastChange': 'Undo Last Change',
        'errorBoundary.downloadBackup': 'Download Backup',
        'errorBoundary.backupDone': 'Backup downloaded.',
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
    historyState.canUndo = true;
    undoMock.mockClear();
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

  it('confirms when the backup download succeeds', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Download Backup'));
    await vi.waitFor(() => expect(screen.getByText('Backup downloaded.')).toBeInTheDocument());
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

  it('offers Undo Last Change when the edit history has an undoable step', () => {
    historyState.canUndo = true;
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Undo Last Change')).toBeInTheDocument();
  });

  it('hides Undo Last Change when there is no undo history', () => {
    historyState.canUndo = false;
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Undo Last Change')).not.toBeInTheDocument();
  });

  it('reverts the last change and recovers the app on Undo click', () => {
    historyState.canUndo = true;
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

    // Simulate undo reverting the bad state that caused the crash.
    undoMock.mockImplementation(() => {
      shouldThrow = false;
    });
    fireEvent.click(screen.getByText('Undo Last Change'));
    expect(undoMock).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
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
