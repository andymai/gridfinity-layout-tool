import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewSkeleton } from './PreviewSkeleton';

describe('PreviewSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with loading state', () => {
    render(<PreviewSkeleton wasmStatus="loading" generationStatus="idle" />);
    expect(screen.getByText('Initializing engine...')).toBeInTheDocument();
  });

  it('shows WASM loading message', () => {
    render(<PreviewSkeleton wasmStatus="loading" generationStatus="idle" />);
    expect(screen.getByText('Initializing engine...')).toBeInTheDocument();
  });

  it('shows WASM error message', () => {
    render(<PreviewSkeleton wasmStatus="error" generationStatus="idle" />);
    expect(screen.getByText('Engine failed to load')).toBeInTheDocument();
  });

  it('shows generation error message', () => {
    render(<PreviewSkeleton wasmStatus="ready" generationStatus="error" />);
    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('shows generating message', () => {
    render(<PreviewSkeleton wasmStatus="ready" generationStatus="generating" />);
    expect(screen.getByText('Generating mesh...')).toBeInTheDocument();
  });

  it('shows retry button for WASM error', () => {
    const onRetry = vi.fn();
    render(<PreviewSkeleton wasmStatus="error" generationStatus="idle" onRetry={onRetry} />);
    expect(screen.getByLabelText(/Retry loading/)).toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<PreviewSkeleton wasmStatus="error" generationStatus="idle" onRetry={onRetry} />);
    fireEvent.click(screen.getByLabelText(/Retry loading/));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows revert button for generation error when history exists', () => {
    const onRevert = vi.fn();
    render(
      <PreviewSkeleton
        wasmStatus="ready"
        generationStatus="error"
        onRevert={onRevert}
        canRevert={true}
      />
    );
    expect(screen.getByLabelText(/Revert/)).toBeInTheDocument();
  });

  it('does not show revert button when no history', () => {
    const onRevert = vi.fn();
    render(
      <PreviewSkeleton
        wasmStatus="ready"
        generationStatus="error"
        onRevert={onRevert}
        canRevert={false}
      />
    );
    expect(screen.queryByLabelText(/Revert/)).not.toBeInTheDocument();
  });

  it('calls onRevert when revert button clicked', () => {
    const onRevert = vi.fn();
    render(
      <PreviewSkeleton
        wasmStatus="ready"
        generationStatus="error"
        onRevert={onRevert}
        canRevert={true}
      />
    );
    fireEvent.click(screen.getByLabelText(/Revert/));
    expect(onRevert).toHaveBeenCalled();
  });

  it('shows custom error message', () => {
    render(
      <PreviewSkeleton wasmStatus="ready" generationStatus="error" errorMessage="Custom error" />
    );
    expect(screen.getByText(/Custom error/)).toBeInTheDocument();
  });

  it('does not show revert button for WASM errors', () => {
    const onRevert = vi.fn();
    render(
      <PreviewSkeleton
        wasmStatus="error"
        generationStatus="idle"
        onRevert={onRevert}
        canRevert={true}
      />
    );
    expect(screen.queryByLabelText(/Revert/)).not.toBeInTheDocument();
  });
});
