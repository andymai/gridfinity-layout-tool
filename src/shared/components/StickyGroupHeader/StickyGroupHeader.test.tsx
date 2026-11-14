import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
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

  it('puts the toggle inside a heading, so each group is a stop in heading navigation', () => {
    render(
      <StickyGroupHeader title="Layers">
        <div>Layer 1</div>
      </StickyGroupHeader>
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Layers' });
    expect(heading).toContainElement(screen.getByRole('button', { name: 'Layers' }));
  });

  it('keeps actions outside the toggle, so using one does not collapse the group', () => {
    const onAdd = vi.fn();
    render(
      <StickyGroupHeader
        title="Layers"
        actions={
          <button type="button" onClick={onAdd}>
            Add layer
          </button>
        }
      >
        <div>Layer 1</div>
      </StickyGroupHeader>
    );
    const toggle = screen.getByRole('button', { name: /Layers/ });
    const add = screen.getByRole('button', { name: 'Add layer' });
    expect(toggle).not.toContainElement(add);
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks which variant it renders', () => {
    const { container } = render(
      <>
        <StickyGroupHeader title="Plain">
          <div>content</div>
        </StickyGroupHeader>
        <StickyGroupHeader title="Group" variant="band">
          <div>content</div>
        </StickyGroupHeader>
      </>
    );
    const variants = [...container.querySelectorAll('[data-variant]')].map((el) =>
      el.getAttribute('data-variant')
    );
    expect(variants).toEqual(['default', 'band']);
  });

  describe('band edge while stuck', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function stubObserver() {
      const observer: { report?: (isIntersecting: boolean, top: number) => void } = {};
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: IntersectionObserverCallback) {
            observer.report = (isIntersecting, top) => {
              const entry = {
                isIntersecting,
                boundingClientRect: { top },
                rootBounds: { top: 0 },
              } as unknown as IntersectionObserverEntry;
              callback([entry], this as unknown as IntersectionObserver);
            };
          }
          observe() {}
          disconnect() {}
        }
      );
      return observer;
    }

    it('shows its edge only once the group has scrolled past the top', () => {
      const observer = stubObserver();
      render(
        <StickyGroupHeader title="Shape" variant="band">
          <div>content</div>
        </StickyGroupHeader>
      );
      const bar = screen.getByRole('heading', { name: 'Shape' }).parentElement;
      expect(bar).not.toHaveAttribute('data-stuck');

      act(() => observer.report?.(false, -40));
      expect(bar).toHaveAttribute('data-stuck');

      act(() => observer.report?.(true, 12));
      expect(bar).not.toHaveAttribute('data-stuck');
    });

    it('stays unstuck while the group is still below the scroll area', () => {
      const observer = stubObserver();
      render(
        <StickyGroupHeader title="Lid" variant="band">
          <div>content</div>
        </StickyGroupHeader>
      );
      act(() => observer.report?.(false, 900));
      expect(screen.getByRole('heading', { name: 'Lid' }).parentElement).not.toHaveAttribute(
        'data-stuck'
      );
    });
  });
});
