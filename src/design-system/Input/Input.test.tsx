import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<Input aria-label="Name" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('applies placeholder', () => {
      render(<Input placeholder="Enter name" aria-label="Name" />);
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    });

    it('forwards native input props', () => {
      render(<Input type="email" aria-label="Email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Input leftIcon={<span data-testid="left" />} aria-label="Search" />);
      expect(screen.getByTestId('left')).toBeInTheDocument();
    });

    it('renders right icon', () => {
      render(<Input rightIcon={<span data-testid="right" />} aria-label="Search" />);
      expect(screen.getByTestId('right')).toBeInTheDocument();
    });

    it('keeps interactive right-icon content accessible (not aria-hidden)', () => {
      render(
        <Input
          aria-label="Search"
          rightIcon={
            <button type="button" aria-label="Clear">
              x
            </button>
          }
        />
      );
      // A clear button passed as rightIcon must remain operable by assistive tech.
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });
  });

  describe('full width', () => {
    it('applies w-full to the wrapper when fullWidth is set', () => {
      const { container } = render(<Input fullWidth aria-label="Search" />);
      expect(container.firstChild).toHaveClass('w-full');
    });
  });

  describe('error state', () => {
    it('sets aria-invalid when error', () => {
      render(<Input error aria-label="Email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not set aria-invalid by default', () => {
      render(<Input aria-label="Email" />);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('disabled', () => {
    it('disables the input', () => {
      render(<Input disabled aria-label="Name" />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('value handling', () => {
    it('handles controlled value', () => {
      render(<Input value="hello" onChange={vi.fn()} aria-label="Name" />);
      expect(screen.getByRole('textbox')).toHaveValue('hello');
    });

    it('calls onChange on input', () => {
      const onChange = vi.fn();
      render(<Input onChange={onChange} aria-label="Name" />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = vi.fn();
      render(<Input ref={ref} aria-label="Name" />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });
  });
});
