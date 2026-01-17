import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '../../shared/components/CollapsibleSection';

describe('CollapsibleSection', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(
        <CollapsibleSection title="Test Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(
        <CollapsibleSection title="Section">
          <div>Child Content</div>
        </CollapsibleSection>
      );

      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders badge when provided', () => {
      render(
        <CollapsibleSection title="Section" badge={<span>3 items</span>}>
          <div>Content</div>
        </CollapsibleSection>
      );

      expect(screen.getByText('3 items')).toBeInTheDocument();
    });

    it('renders actions when provided', () => {
      render(
        <CollapsibleSection title="Section" actions={<button>Action</button>}>
          <div>Content</div>
        </CollapsibleSection>
      );

      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('expanded state', () => {
    it('is expanded by default', () => {
      render(
        <CollapsibleSection title="Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('starts collapsed when defaultExpanded is false', () => {
      render(
        <CollapsibleSection title="Section" defaultExpanded={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles when clicked', () => {
      render(
        <CollapsibleSection title="Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('accessibility', () => {
    it('button has aria-controls pointing to content', () => {
      render(
        <CollapsibleSection title="Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      const button = screen.getByRole('button');
      const contentId = button.getAttribute('aria-controls');
      expect(contentId).toBeTruthy();
      expect(document.getElementById(contentId!)).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(
        <CollapsibleSection title="Section" variant="default">
          <div>Content</div>
        </CollapsibleSection>
      );

      const title = screen.getByText('Section');
      expect(title).toHaveClass('text-sm');
    });

    it('applies small variant styles', () => {
      render(
        <CollapsibleSection title="Section" variant="small">
          <div>Content</div>
        </CollapsibleSection>
      );

      const title = screen.getByText('Section');
      expect(title).toHaveClass('text-xs');
      expect(title).toHaveClass('uppercase');
    });
  });

  describe('animation behavior', () => {
    it('does not animate on initial render', () => {
      const { container } = render(
        <CollapsibleSection title="Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      // Content container should not have transition class initially
      const contentContainer = container.querySelector('[id]');
      expect(contentContainer).not.toHaveClass('transition-all');
    });

    it('adds animation class after first toggle', () => {
      const { container } = render(
        <CollapsibleSection title="Section">
          <div>Content</div>
        </CollapsibleSection>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // After toggle, content container should have transition class
      const contentContainer = container.querySelector('[id]');
      expect(contentContainer).toHaveClass('transition-all');
    });
  });
});
