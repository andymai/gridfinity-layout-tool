import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  track3DRenderError: vi.fn(),
}));

// Mock storage
vi.mock('@/core/storage', () => ({
  clearAllAppData: vi.fn().mockResolvedValue(undefined),
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
        'errorBoundary.hint': 'Try refreshing or resetting.',
        'errorBoundary.tryAgain': 'Try Again',
        'errorBoundary.resetAppData': 'Reset App Data',
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

    // After clicking Try Again, the error boundary resets
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    // Need to force a rerender to see the updated child
    rerender(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reset App Data')).toBeInTheDocument();
  });

  it('calls clearAllAppData and reloads on Reset App Data click', async () => {
    const { clearAllAppData } = await import('@/core/storage');
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    try {
      render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Reset App Data'));
      expect(clearAllAppData).toHaveBeenCalled();
      await vi.waitFor(() => expect(reloadMock).toHaveBeenCalled());
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('reloads even if clearAllAppData rejects', async () => {
    const { clearAllAppData } = await import('@/core/storage');
    vi.mocked(clearAllAppData).mockRejectedValueOnce(new Error('IDB failure'));
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    try {
      render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Reset App Data'));
      await vi.waitFor(() => expect(reloadMock).toHaveBeenCalled());
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
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
