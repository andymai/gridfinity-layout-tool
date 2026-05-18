import { describe, it, expect, vi } from 'vitest';
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

  it('keeps summary visible when expanded for quick-glance context', () => {
    render(
      <StickyGroupHeader title="Shape" defaultExpanded summary="2x2x3u">
        <div>content</div>
      </StickyGroupHeader>
    );

    expect(screen.getByText('2x2x3u')).toBeInTheDocument();
  });

  describe('controlled mode', () => {
    it('reflects the controlled `expanded` prop on aria-expanded', () => {
      const { rerender } = render(
        <StickyGroupHeader title="Shape" expanded={false} onExpandedChange={() => {}}>
          <div>content</div>
        </StickyGroupHeader>
      );

      const button = screen.getByText('Shape').closest('button')!;
      expect(button).toHaveAttribute('aria-expanded', 'false');

      rerender(
        <StickyGroupHeader title="Shape" expanded={true} onExpandedChange={() => {}}>
          <div>content</div>
        </StickyGroupHeader>
      );
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('invokes onExpandedChange when the header is clicked', () => {
      const onExpandedChange = vi.fn();
      render(
        <StickyGroupHeader title="Shape" expanded={false} onExpandedChange={onExpandedChange}>
          <div>content</div>
        </StickyGroupHeader>
      );

      fireEvent.click(screen.getByText('Shape').closest('button')!);
      expect(onExpandedChange).toHaveBeenCalledWith(true);
    });

    it('does not update its own state when controlled (parent must drive)', () => {
      render(
        <StickyGroupHeader title="Shape" expanded={false} onExpandedChange={() => {}}>
          <div>content</div>
        </StickyGroupHeader>
      );

      const button = screen.getByText('Shape').closest('button')!;
      fireEvent.click(button);
      // Parent never updated `expanded` — header must stay closed.
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
