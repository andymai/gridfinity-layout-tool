import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelErrorBoundary } from './PanelErrorBoundary';

vi.mock('@/shared/analytics/posthog', () => ({
  captureException: vi.fn(),
  track3DRenderError: vi.fn(),
}));

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Panel error');
  return <div>Panel content</div>;
}

describe('PanelErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <ThrowingChild shouldThrow={false} />
      </PanelErrorBoundary>
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('renders panel-specific error when child throws', () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <ThrowingChild shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByText('Inspector Error')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <ThrowingChild shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByText('Panel error')).toBeInTheDocument();
  });

  it('resets error state on retry', () => {
    let shouldThrow = true;
    const DynamicChild = () => {
      if (shouldThrow) throw new Error('Panel error');
      return <div>Panel content</div>;
    };

    const { rerender } = render(
      <PanelErrorBoundary panelName="Inspector">
        <DynamicChild />
      </PanelErrorBoundary>
    );
    expect(screen.getByText('Inspector Error')).toBeInTheDocument();

    // After clicking Retry, the error boundary resets
    shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));

    // Need to force a rerender to see the updated child
    rerender(
      <PanelErrorBoundary panelName="Inspector">
        <DynamicChild />
      </PanelErrorBoundary>
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    render(
      <PanelErrorBoundary panelName="Inspector" onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('has role=alert and aria-live=assertive for screen readers', () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <ThrowingChild shouldThrow={true} />
      </PanelErrorBoundary>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
