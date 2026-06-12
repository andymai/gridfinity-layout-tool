import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  describe('rendering', () => {
    it('renders the label and children', () => {
      render(
        <Field label="Width">
          <input aria-label="Width value" />
        </Field>
      );
      expect(screen.getByText('Width')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('applies className to the wrapper', () => {
      const { container } = render(
        <Field label="Width" className="custom-class">
          <input />
        </Field>
      );
      expect(container.firstElementChild).toHaveClass('custom-class');
    });

    it('forwards ref to the wrapper element', () => {
      const ref = vi.fn();
      render(
        <Field label="Width" ref={ref}>
          <input />
        </Field>
      );
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('label element', () => {
    it('renders a <label> associated with the control when htmlFor is given', () => {
      render(
        <Field label="Pattern" htmlFor="pattern-select">
          <select id="pattern-select">
            <option>Hex</option>
          </select>
        </Field>
      );
      const caption = screen.getByText('Pattern');
      expect(caption.tagName).toBe('LABEL');
      expect(caption).toHaveAttribute('for', 'pattern-select');
      expect(screen.getByLabelText('Pattern')).toBe(screen.getByRole('combobox'));
    });

    it('renders a <span> caption when htmlFor is omitted', () => {
      const { container } = render(
        <Field label="Divider height">
          <div role="group" aria-label="Divider height" />
        </Field>
      );
      expect(screen.getByText('Divider height').tagName).toBe('SPAN');
      expect(container.querySelector('label')).toBeNull();
    });
  });

  describe('trailing slot', () => {
    it('renders trailing content in the caption row', () => {
      render(
        <Field label="Width" trailing={<span>42mm</span>}>
          <input />
        </Field>
      );
      const trailing = screen.getByText('42mm');
      expect(trailing).toBeInTheDocument();
      expect(trailing.parentElement).toBe(screen.getByText('Width').parentElement);
    });
  });

  describe('hint and error', () => {
    it('renders the hint below the control', () => {
      render(
        <Field label="Size" hint="≥ 40mm (+2mm)">
          <input />
        </Field>
      );
      const hint = screen.getByText('≥ 40mm (+2mm)');
      expect(hint).toBeInTheDocument();
      expect(hint.className).toContain('text-content-tertiary');
    });

    it('renders the error with error styling', () => {
      render(
        <Field label="Name" error="Name is required">
          <input />
        </Field>
      );
      const error = screen.getByText('Name is required');
      expect(error).toBeInTheDocument();
      expect(error.className).toContain('text-error');
    });

    it('gives the error line an id derived from htmlFor for aria-describedby', () => {
      render(
        <Field label="Name" htmlFor="name-input" error="Name is required">
          <input id="name-input" aria-describedby="name-input-error" />
        </Field>
      );
      const error = screen.getByText('Name is required');
      expect(error).toHaveAttribute('id', 'name-input-error');
      expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Name is required');
    });

    it('does not set an id on the error line without htmlFor', () => {
      render(
        <Field label="Name" error="Name is required">
          <input />
        </Field>
      );
      expect(screen.getByText('Name is required')).not.toHaveAttribute('id');
    });

    it('shows the error instead of the hint when both are set', () => {
      render(
        <Field label="Name" hint="Pick something short" error="Name is required">
          <input />
        </Field>
      );
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.queryByText('Pick something short')).not.toBeInTheDocument();
    });
  });

  describe('label tone', () => {
    it('defaults to the tertiary caption tone', () => {
      render(
        <Field label="Width">
          <input />
        </Field>
      );
      const caption = screen.getByText('Width');
      expect(caption.className).toContain('text-content-tertiary');
      expect(caption.className).toContain('text-xs');
      expect(caption.className).not.toContain('font-medium');
    });

    it('applies the secondary caption tone', () => {
      render(
        <Field label="Width" labelTone="secondary">
          <input />
        </Field>
      );
      const caption = screen.getByText('Width');
      expect(caption.className).toContain('text-content-secondary');
      expect(caption.className).toContain('font-medium');
    });
  });
});
