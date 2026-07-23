import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedDimensionInput } from './LinkedDimensionInput';

const LABELS = {
  widthAriaLabel: 'Width',
  depthAriaLabel: 'Depth',
  linkAriaLabel: 'Link',
  unlinkAriaLabel: 'Unlink',
};

function renderInput(props: Partial<Parameters<typeof LinkedDimensionInput>[0]> = {}) {
  return render(
    <LinkedDimensionInput
      width={42}
      depth={42}
      onChange={vi.fn()}
      min={1}
      max={200}
      {...LABELS}
      {...props}
    />
  );
}

describe('LinkedDimensionInput', () => {
  it('renders a single input when width equals depth', () => {
    renderInput();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
  });

  it('renders two inputs when the values differ', () => {
    renderInput({ depth: 40 });
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    expect(screen.getByLabelText('Depth')).toHaveValue(40);
  });

  it('expands to two inputs on unlink click', () => {
    renderInput();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('calls onChange with only the width while linked', () => {
    const onChange = vi.fn();
    renderInput({ onChange });
    const input = screen.getByLabelText('Width');
    fireEvent.change(input, { target: { value: '48' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(48);
  });

  it('calls onChange with both values when the depth diverges', () => {
    const onChange = vi.fn();
    renderInput({ onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    const depthInput = screen.getByLabelText('Depth');
    fireEvent.change(depthInput, { target: { value: '40' } });
    fireEvent.blur(depthInput);
    expect(onChange).toHaveBeenCalledWith(42, 40);
  });

  it('collapses back to square on relink', () => {
    const onChange = vi.fn();
    renderInput({ depth: 40, onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('drops the depth when it is edited back to equal the width', () => {
    const onChange = vi.fn();
    renderInput({ depth: 40, onChange });
    const depthInput = screen.getByLabelText('Depth');
    fireEvent.change(depthInput, { target: { value: '42' } });
    fireEvent.blur(depthInput);
    expect(onChange).toHaveBeenCalledWith(42, undefined);
  });

  it('forwards id to the first input', () => {
    renderInput({ id: 'someId' });
    expect(screen.getByLabelText('Width').id).toBe('someId');
  });
});
