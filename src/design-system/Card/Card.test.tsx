import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  describe('rendering', () => {
    it('renders children in a div by default', () => {
      render(<Card>Content</Card>);
      const card = screen.getByText('Content');
      expect(card.tagName).toBe('DIV');
    });

    it('applies default surface, border, padding, and radius classes', () => {
      render(<Card>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass(
        'bg-surface-elevated',
        'border',
        'border-stroke-subtle',
        'p-3',
        'rounded-lg'
      );
    });

    it('merges className with caller classes winning conflicts', () => {
      render(<Card className="p-6 custom-class">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('p-6', 'custom-class');
      expect(card).not.toHaveClass('p-3');
    });
  });

  describe('surface variant', () => {
    it('applies bg-surface', () => {
      render(<Card surface="surface">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('bg-surface');
    });

    it('applies bg-surface-secondary', () => {
      render(<Card surface="secondary">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('bg-surface-secondary');
    });
  });

  describe('border variant', () => {
    it('applies border-stroke for default', () => {
      render(<Card border="default">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('border', 'border-stroke');
    });

    it('applies a 2px dashed border for dashed', () => {
      render(<Card border="dashed">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('border-2', 'border-dashed', 'border-stroke');
    });

    it('removes the border for none', () => {
      render(<Card border="none">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('border-none');
      expect(card).not.toHaveClass('border-stroke-subtle');
    });
  });

  describe('padding variant', () => {
    it('applies p-0 for none', () => {
      render(<Card padding="none">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-0');
    });

    it('applies p-2 for sm', () => {
      render(<Card padding="sm">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-2');
    });

    it('applies p-4 for lg', () => {
      render(<Card padding="lg">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-4');
    });
  });

  describe('radius variant', () => {
    it('applies rounded-md', () => {
      render(<Card radius="md">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('rounded-md');
    });

    it('applies rounded-xl', () => {
      render(<Card radius="xl">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('rounded-xl');
    });
  });

  describe('as', () => {
    it('renders a button with type="button"', () => {
      render(<Card as="button">Open</Card>);
      const card = screen.getByRole('button', { name: 'Open' });
      expect(card.tagName).toBe('BUTTON');
      expect(card).toHaveAttribute('type', 'button');
    });

    it('does not set type on non-button elements', () => {
      render(<Card>Content</Card>);
      expect(screen.getByText('Content')).not.toHaveAttribute('type');
    });

    it('renders a list item', () => {
      render(
        <ul>
          <Card as="li">Item</Card>
        </ul>
      );
      expect(screen.getByRole('listitem')).toHaveTextContent('Item');
    });

    it('renders a section', () => {
      render(<Card as="section">Content</Card>);
      expect(screen.getByText('Content').tagName).toBe('SECTION');
    });
  });

  describe('interactions', () => {
    it('calls onClick when an interactive button card is clicked', () => {
      const onClick = vi.fn();
      render(
        <Card as="button" interactive onClick={onClick}>
          Open
        </Card>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies hover, focus ring, and press classes when interactive', () => {
      render(<Card interactive>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass(
        'hover:bg-surface-hover',
        'hover:border-stroke',
        'focus-visible:outline-2',
        'focus-visible:outline-accent',
        'active:scale-[0.98]'
      );
    });

    it('does not apply interactive classes by default', () => {
      render(<Card>Content</Card>);
      const card = screen.getByText('Content');
      expect(card).not.toHaveClass('hover:bg-surface-hover');
      expect(card).not.toHaveClass('active:scale-[0.98]');
    });
  });

  describe('selected', () => {
    it('applies the accent border treatment by default', () => {
      render(<Card selected>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('border-accent', 'bg-surface-hover');
    });

    it('applies the accent rail treatment for selectedStyle="rail"', () => {
      render(
        <Card selected selectedStyle="rail">
          Content
        </Card>
      );
      const card = screen.getByText('Content');
      expect(card).toHaveClass('border-l-2', 'border-l-accent');
      expect(card).not.toHaveClass('border-accent');
    });

    it('does not apply selected classes when not selected', () => {
      render(<Card selectedStyle="rail">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).not.toHaveClass('border-l-accent');
      expect(card).not.toHaveClass('border-accent');
    });

    it('passes through caller-provided aria-selected', () => {
      render(
        <Card as="li" role="option" selected aria-selected>
          Item
        </Card>
      );
      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the div element', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Content</Card>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    it('forwards ref to the button element', () => {
      const ref = vi.fn();
      render(
        <Card as="button" ref={ref}>
          Open
        </Card>
      );
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });
});
