import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  describe('rendering', () => {
    it('renders a textarea element', () => {
      render(<Textarea aria-label="Notes" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('applies placeholder', () => {
      render(<Textarea placeholder="Paste JSON here" aria-label="Import" />);
      expect(screen.getByPlaceholderText('Paste JSON here')).toBeInTheDocument();
    });

    it('forwards native textarea props', () => {
      render(<Textarea rows={3} readOnly aria-label="Notes" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '3');
      expect(textarea).toHaveAttribute('readonly');
    });

    it('applies className to the textarea', () => {
      render(<Textarea className="min-h-[200px] flex-1" aria-label="Import" />);
      expect(screen.getByRole('textbox')).toHaveClass('min-h-[200px]', 'flex-1');
    });
  });

  describe('variants', () => {
    it('applies font-mono when mono', () => {
      render(<Textarea mono aria-label="Import" />);
      expect(screen.getByRole('textbox')).toHaveClass('font-mono');
    });

    it('does not apply font-mono by default', () => {
      render(<Textarea aria-label="Notes" />);
      expect(screen.getByRole('textbox')).not.toHaveClass('font-mono');
    });

    it('applies resize-y by default', () => {
      render(<Textarea aria-label="Notes" />);
      expect(screen.getByRole('textbox')).toHaveClass('resize-y');
    });

    it('applies resize-none when resize is none', () => {
      render(<Textarea resize="none" aria-label="Import" />);
      expect(screen.getByRole('textbox')).toHaveClass('resize-none');
      expect(screen.getByRole('textbox')).not.toHaveClass('resize-y');
    });
  });

  describe('selectOnClick', () => {
    it('selects content on click when selectOnClick', () => {
      render(<Textarea selectOnClick readOnly value="{}" aria-label="Share data" />);
      const textarea = screen.getByRole<HTMLTextAreaElement>('textbox');
      textarea.select = vi.fn();
      fireEvent.click(textarea);
      expect(textarea.select).toHaveBeenCalled();
    });

    it('does not select content on click by default', () => {
      render(<Textarea readOnly value="{}" aria-label="Share data" />);
      const textarea = screen.getByRole<HTMLTextAreaElement>('textbox');
      textarea.select = vi.fn();
      fireEvent.click(textarea);
      expect(textarea.select).not.toHaveBeenCalled();
    });

    it('still calls onClick when selectOnClick', () => {
      const onClick = vi.fn();
      render(
        <Textarea selectOnClick onClick={onClick} readOnly value="{}" aria-label="Share data" />
      );
      fireEvent.click(screen.getByRole('textbox'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('character counter', () => {
    it('renders the counter from value length and maxLength', () => {
      render(
        <Textarea showCount maxLength={500} value="hello" onChange={vi.fn()} aria-label="Notes" />
      );
      expect(screen.getByText('5/500')).toBeInTheDocument();
    });

    it('updates the counter when value changes', () => {
      const { rerender } = render(
        <Textarea showCount maxLength={500} value="hello" onChange={vi.fn()} aria-label="Notes" />
      );
      rerender(
        <Textarea
          showCount
          maxLength={500}
          value="hello world"
          onChange={vi.fn()}
          aria-label="Notes"
        />
      );
      expect(screen.getByText('11/500')).toBeInTheDocument();
    });

    it('hides the counter from assistive technology', () => {
      render(
        <Textarea showCount maxLength={500} value="hi" onChange={vi.fn()} aria-label="Notes" />
      );
      expect(screen.getByText('2/500')).toHaveAttribute('aria-hidden', 'true');
    });

    it('does not render a counter without showCount', () => {
      render(<Textarea maxLength={500} value="hello" onChange={vi.fn()} aria-label="Notes" />);
      expect(screen.queryByText('5/500')).not.toBeInTheDocument();
    });

    it('does not render a counter without maxLength', () => {
      render(<Textarea showCount value="hello" onChange={vi.fn()} aria-label="Notes" />);
      expect(screen.queryByText(/\/\d+$/)).not.toBeInTheDocument();
    });
  });

  describe('value handling', () => {
    it('passes maxLength through to the textarea', () => {
      render(<Textarea maxLength={500} aria-label="Notes" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '500');
    });

    it('handles controlled value', () => {
      render(<Textarea value="hello" onChange={vi.fn()} aria-label="Notes" />);
      expect(screen.getByRole('textbox')).toHaveValue('hello');
    });

    it('calls onChange on input', () => {
      const onChange = vi.fn();
      render(<Textarea onChange={onChange} aria-label="Notes" />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('disables the textarea', () => {
      render(<Textarea disabled aria-label="Notes" />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the textarea element', () => {
      const ref = vi.fn();
      render(<Textarea ref={ref} aria-label="Notes" />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLTextAreaElement));
    });
  });
});
