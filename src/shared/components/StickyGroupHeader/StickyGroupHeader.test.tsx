import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickyGroupHeader } from './StickyGroupHeader';

describe('StickyGroupHeader', () => {
  it('renders title and children', () => {
    render(
      <StickyGroupHeader title="Test Section">
        <div>child content</div>
      </StickyGroupHeader>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('collapses and expands on click', () => {
    render(
      <StickyGroupHeader title="Shape" defaultExpanded>
        <div>content</div>
      </StickyGroupHeader>
    );

    const button = screen.getByText('Shape').closest('button')!;
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows summary when collapsed', () => {
    render(
      <StickyGroupHeader title="Shape" defaultExpanded={false} summary="2x2x3u">
        <div>content</div>
      </StickyGroupHeader>
    );

    expect(screen.getByText('2x2x3u')).toBeInTheDocument();
  });

  it('hides summary when expanded', () => {
    render(
      <StickyGroupHeader title="Shape" defaultExpanded summary="2x2x3u">
        <div>content</div>
      </StickyGroupHeader>
    );

    expect(screen.queryByText('2x2x3u')).not.toBeInTheDocument();
  });
});
