import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  describe('rendering', () => {
    it('renders children and tooltip content', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Undo');
    });

    it('is hidden by default', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-0');
    });

    it('renders the shortcut in mono kbd styling', () => {
      render(
        <Tooltip content="Undo" shortcut="⌘Z">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const kbd = screen.getByText('⌘Z');
      expect(kbd.tagName).toBe('KBD');
      expect(kbd).toHaveClass('font-mono', 'text-content-tertiary');
    });

    it('omits the kbd element when no shortcut is given', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip').querySelector('kbd')).toBeNull();
    });
  });

  describe('placement', () => {
    it('defaults to top placement', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip')).toHaveClass('bottom-full');
    });

    it.each([
      ['top', 'bottom-full'],
      ['bottom', 'top-full'],
      ['left', 'right-full'],
      ['right', 'left-full'],
    ] as const)('applies %s placement classes', (placement, expectedClass) => {
      render(
        <Tooltip content="Undo" placement={placement}>
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip')).toHaveClass(expectedClass);
    });
  });

  describe('interactions', () => {
    it('becomes visible when the trigger receives focus', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      fireEvent.focus(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');
    });

    it('hides again when the trigger loses focus', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const button = screen.getByRole('button');
      fireEvent.focus(button);
      fireEvent.blur(button);
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-0');
    });

    it('becomes visible on hover and hides on leave', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const wrapper = screen.getByRole('tooltip').parentElement as HTMLElement;
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');
      fireEvent.mouseLeave(wrapper);
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-0');
    });

    it('hides on Escape while focused', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const button = screen.getByRole('button');
      fireEvent.focus(button);
      fireEvent.keyDown(button, { key: 'Escape' });
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-0');
    });

    it('can show again after Escape dismissal once focus is lost and regained', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const button = screen.getByRole('button');
      fireEvent.focus(button);
      fireEvent.keyDown(button, { key: 'Escape' });
      fireEvent.blur(button);
      fireEvent.focus(button);
      expect(screen.getByRole('tooltip')).toHaveClass('opacity-100');
    });

    it('applies the show delay only while visible', () => {
      render(
        <Tooltip content="Undo" delayMs={500}>
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip.getAttribute('style')).toContain('transition-delay: 0ms');
      fireEvent.focus(screen.getByRole('button'));
      expect(tooltip.getAttribute('style')).toContain('transition-delay: 500ms');
    });
  });

  describe('accessibility', () => {
    it('wires aria-describedby on the trigger element to the tooltip id', () => {
      render(
        <Tooltip content="Undo">
          <button type="button">Trigger</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(tooltip.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
      expect(tooltip.parentElement).not.toHaveAttribute('aria-describedby');
    });

    it('merges the tooltip id into an existing aria-describedby on the trigger', () => {
      render(
        <Tooltip content="Undo">
          <button type="button" aria-describedby="existing-id">
            Trigger
          </button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(trigger).toHaveAttribute('aria-describedby', `existing-id ${tooltip.id}`);
    });

    it('works around disabled triggers without blocking them', () => {
      render(
        <Tooltip content="Undo">
          <button type="button" disabled>
            Trigger
          </button>
        </Tooltip>
      );
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('renders children only when disabled', () => {
      render(
        <Tooltip content="Undo" disabled>
          <button type="button">Trigger</button>
        </Tooltip>
      );
      expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
