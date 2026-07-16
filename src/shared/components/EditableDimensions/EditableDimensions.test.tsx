import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableDimensions } from './EditableDimensions';

describe('EditableDimensions', () => {
  const defaultProps = {
    widthMm: 441,
    depthMm: 357,
    minMm: 21,
    maxMm: 2300,
    onCommit: vi.fn(),
    'aria-label': 'Edit dimensions',
    widthLabel: 'Width mm',
    depthLabel: 'Depth mm',
  };

  it('renders as a button with formatted dimensions at rest', () => {
    render(<EditableDimensions {...defaultProps} />);
    const btn = screen.getByRole('button', { name: 'Edit dimensions' });
    expect(btn).toHaveTextContent(/441\s*×\s*357\s*mm/);
  });

  it('shows persistent edit affordance classes on the button', () => {
    render(<EditableDimensions {...defaultProps} />);
    const btn = screen.getByRole('button', { name: 'Edit dimensions' });
    expect(btn.className).toContain('underline');
    expect(btn.className).toContain('decoration-dotted');
    expect(btn.className).toContain('cursor-pointer');
  });

  it('enters edit mode on click, showing two inputs', () => {
    render(<EditableDimensions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit dimensions' }));

    const widthInput = screen.getByLabelText('Width mm');
    const depthInput = screen.getByLabelText('Depth mm');
    expect(widthInput).toBeInTheDocument();
    expect(depthInput).toBeInTheDocument();
    expect(widthInput).toHaveValue(441);
    expect(depthInput).toHaveValue(357);
  });

  it('commits values on Enter', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    fireEvent.change(widthInput, { target: { value: '450' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith(450, 357);
  });

  it('commits values on blur outside container', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const depthInput = screen.getByLabelText('Depth mm');
    fireEvent.change(depthInput, { target: { value: '400' } });
    // Blur with relatedTarget outside the container
    fireEvent.blur(depthInput, { relatedTarget: document.body });

    expect(onCommit).toHaveBeenCalledWith(441, 400);
  });

  it('does not commit when tabbing between width and depth inputs', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    const depthInput = screen.getByLabelText('Depth mm');

    // Tab from width to depth — relatedTarget is the depth input (inside container)
    fireEvent.blur(widthInput, { relatedTarget: depthInput });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('cancels edit on Escape without committing', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    fireEvent.change(widthInput, { target: { value: '999' } });
    fireEvent.keyDown(widthInput, { key: 'Escape' });

    expect(onCommit).not.toHaveBeenCalled();
    // Should return to button display
    expect(screen.getByRole('button', { name: 'Edit dimensions' })).toBeInTheDocument();
  });

  it('clamps values to minimum', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    fireEvent.change(widthInput, { target: { value: '5' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith(21, 357);
  });

  it('clamps values to maximum', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    fireEvent.change(widthInput, { target: { value: '9999' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith(2300, 357);
  });

  it('does not commit on invalid (NaN) input', () => {
    const onCommit = vi.fn();
    render(<EditableDimensions {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button'));

    const widthInput = screen.getByLabelText('Width mm');
    fireEvent.change(widthInput, { target: { value: 'abc' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows fractional display values without trailing zeros', () => {
    render(<EditableDimensions {...defaultProps} widthMm={441.6} depthMm={357.2} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent(/441\.6\s*×\s*357\.2\s*mm/);
  });

  describe('with a height field', () => {
    const heightProps = {
      ...defaultProps,
      heightMm: 84,
      minHeightMm: 7,
      maxHeightMm: 350,
      heightLabel: 'Height mm',
    };

    it('renders all three dimensions at rest', () => {
      render(<EditableDimensions {...heightProps} />);
      const btn = screen.getByRole('button', { name: 'Edit dimensions' });
      expect(btn).toHaveTextContent(/441\s*×\s*357\s*×\s*84\s*mm/);
    });

    it('commits all three values, clamping height to its own bounds', () => {
      const onCommit = vi.fn();
      render(<EditableDimensions {...heightProps} onCommit={onCommit} />);
      fireEvent.click(screen.getByRole('button'));

      const heightInput = screen.getByLabelText('Height mm');
      expect(heightInput).toHaveValue(84);
      fireEvent.change(heightInput, { target: { value: '9999' } });
      fireEvent.keyDown(heightInput, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledWith(441, 357, 350);
    });

    it('does not commit when the height is invalid', () => {
      const onCommit = vi.fn();
      render(<EditableDimensions {...heightProps} onCommit={onCommit} />);
      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByLabelText('Height mm'), { target: { value: 'abc' } });
      fireEvent.keyDown(screen.getByLabelText('Height mm'), { key: 'Enter' });

      expect(onCommit).not.toHaveBeenCalled();
    });
  });
});
