import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PublishPreview } from './PublishPreview';

const THUMBS = ['data:image/webp;base64,AA==', 'QUJD', 'REVG'];

describe('PublishPreview', () => {
  it('waits without offering a retry while a capture is still running', () => {
    render(<PublishPreview thumbnails={null} captureFailed={false} onRetry={vi.fn()} />);
    expect(screen.getByText('Preparing preview…')).toBeInTheDocument();
    expect(screen.queryByText('Retry preview')).not.toBeInTheDocument();
  });

  it('offers a retry once a capture has actually failed', () => {
    const onRetry = vi.fn();
    render(<PublishPreview thumbnails={null} captureFailed onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry preview'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('leads with one large angle and offers the rest as a strip', () => {
    render(<PublishPreview thumbnails={THUMBS} captureFailed={false} onRetry={vi.fn()} />);
    expect(screen.getAllByAltText(/Design preview/)).toHaveLength(1);
    expect(screen.getByAltText('Design preview 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('switches the large image when another angle is chosen', () => {
    render(<PublishPreview thumbnails={THUMBS} captureFailed={false} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show angle 3'));
    expect(screen.getByAltText('Design preview 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Show angle 3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the strip when there is only one angle to choose from', () => {
    render(<PublishPreview thumbnails={['QUJD']} captureFailed={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('falls back to the first angle when a recapture returns fewer', () => {
    const { rerender } = render(
      <PublishPreview thumbnails={THUMBS} captureFailed={false} onRetry={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Show angle 3'));
    rerender(<PublishPreview thumbnails={['QUJD']} captureFailed={false} onRetry={vi.fn()} />);
    expect(screen.getByAltText('Design preview 1')).toBeInTheDocument();
  });

  it('renders raw base64 captures as webp data URLs', () => {
    render(<PublishPreview thumbnails={['QUJD']} captureFailed={false} onRetry={vi.fn()} />);
    expect(screen.getByAltText('Design preview 1')).toHaveAttribute(
      'src',
      'data:image/webp;base64,QUJD'
    );
  });
});
