import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Collapsible } from './Collapsible';

describe('Collapsible', () => {
  describe('uncontrolled mode', () => {
    it('starts expanded by default', () => {
      render(<Collapsible title="Settings">Content</Collapsible>);
      expect(screen.getByRole('region')).toHaveAttribute('aria-hidden', 'false');
    });

    it('starts collapsed when defaultExpanded is false', () => {
      render(
        <Collapsible title="Settings" defaultExpanded={false}>
          Content
        </Collapsible>
      );
      expect(screen.getByRole('region', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
    });

    it('toggles on click', () => {
      render(<Collapsible title="Settings">Content</Collapsible>);
      const trigger = screen.getByRole('button', { name: /Settings/ });

      fireEvent.click(trigger);
      expect(screen.getByRole('region', { hidden: true })).toHaveAttribute('aria-hidden', 'true');

      fireEvent.click(trigger);
      expect(screen.getByRole('region')).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('controlled mode', () => {
    it('reflects controlled expanded state', () => {
      render(
        <Collapsible title="Settings" expanded={true} onExpandedChange={vi.fn()}>
          Content
        </Collapsible>
      );
      expect(screen.getByRole('region')).toHaveAttribute('aria-hidden', 'false');
    });

    it('calls onExpandedChange on toggle', () => {
      const onChange = vi.fn();
      render(
        <Collapsible title="Settings" expanded={true} onExpandedChange={onChange}>
          Content
        </Collapsible>
      );
      fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('accessibility', () => {
    it('has aria-expanded on trigger', () => {
      render(<Collapsible title="Settings">Content</Collapsible>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-controls linking trigger to content', () => {
      render(<Collapsible title="Settings">Content</Collapsible>);
      const trigger = screen.getByRole('button');
      const contentId = trigger.getAttribute('aria-controls');
      expect(contentId).toBeTruthy();
      expect(screen.getByRole('region')).toHaveAttribute('id', contentId);
    });

    it('labels region with trigger', () => {
      render(<Collapsible title="Settings">Content</Collapsible>);
      const trigger = screen.getByRole('button');
      const triggerId = trigger.getAttribute('id');
      expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', triggerId);
    });
  });

  describe('optional elements', () => {
    it('renders badge', () => {
      render(
        <Collapsible title="Items" badge={<span data-testid="badge">5</span>}>
          Content
        </Collapsible>
      );
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('renders actions', () => {
      render(
        <Collapsible title="Items" actions={<button data-testid="action">Add</button>}>
          Content
        </Collapsible>
      );
      expect(screen.getByTestId('action')).toBeInTheDocument();
    });

    it('shows summary when collapsed', () => {
      render(
        <Collapsible title="Dims" defaultExpanded={false} summary="2x2x3u">
          Content
        </Collapsible>
      );
      expect(screen.getByText('2x2x3u')).toBeInTheDocument();
    });

    it('hides summary when expanded', () => {
      render(
        <Collapsible title="Dims" defaultExpanded={true} summary="2x2x3u">
          Content
        </Collapsible>
      );
      expect(screen.queryByText('2x2x3u')).not.toBeInTheDocument();
    });
  });
});
