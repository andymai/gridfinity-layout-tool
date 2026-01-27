import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnappingSlider } from '../../components/controls/SnappingSlider';
import type { SnappingSliderOption } from '../../components/controls/SnappingSlider';

describe('SnappingSlider', () => {
  const options: SnappingSliderOption[] = [
    { value: 0.4, description: 'Fastest print' },
    { value: 0.8, description: 'Balanced' },
    { value: 1.2, description: 'Standard' },
    { value: 1.6, description: 'Durable' },
    { value: 2.0, description: 'Very sturdy' },
  ];

  const defaultProps = {
    label: 'Wall thickness',
    value: 1.2,
    onChange: vi.fn(),
    options,
  };

  it('renders label and current value', () => {
    render(<SnappingSlider {...defaultProps} />);
    expect(screen.getByText('Wall thickness')).toBeInTheDocument();
    expect(screen.getByText('1.2 mm')).toBeInTheDocument();
  });

  it('renders tick marks for each option', () => {
    render(<SnappingSlider {...defaultProps} />);
    // Each option has a button with aria-label (note: 2.0 renders as "2" in JS)
    expect(screen.getByLabelText('Select 0.4mm')).toBeInTheDocument();
    expect(screen.getByLabelText('Select 0.8mm')).toBeInTheDocument();
    expect(screen.getByLabelText('Select 1.2mm')).toBeInTheDocument();
    expect(screen.getByLabelText('Select 1.6mm')).toBeInTheDocument();
    expect(screen.getByLabelText('Select 2mm')).toBeInTheDocument();
  });

  it('shows description for current value', () => {
    render(<SnappingSlider {...defaultProps} value={1.2} />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('updates description when value changes', () => {
    const { rerender } = render(<SnappingSlider {...defaultProps} value={0.4} />);
    expect(screen.getByText('Fastest print')).toBeInTheDocument();

    rerender(<SnappingSlider {...defaultProps} value={2.0} />);
    expect(screen.getByText('Very sturdy')).toBeInTheDocument();
  });

  it('calls onChange when tick is clicked', () => {
    const onChange = vi.fn();
    render(<SnappingSlider {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Select 0.8mm'));
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('calls onChange with snapped value on pointer release', () => {
    const onChange = vi.fn();
    const { container } = render(<SnappingSlider {...defaultProps} onChange={onChange} />);

    // The slider track is the div with role="slider" (not the input)
    const slider = container.querySelector('div[role="slider"]') as HTMLElement;

    // Mock getBoundingClientRect for position calculation
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 100,
      width: 100,
      top: 0,
      bottom: 32,
      height: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Simulate pointer drag to ~25% (should snap to 0.8)
    fireEvent.pointerDown(slider, { clientX: 25, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled(); // Not called during drag
    fireEvent.pointerUp(slider, { clientX: 25, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(0.8); // Snapped to nearest
  });

  it('applies disabled styling', () => {
    const { container } = render(<SnappingSlider {...defaultProps} disabled />);
    expect(container.querySelector('.opacity-50')).not.toBeNull();
  });

  it('does not call onChange when disabled and tick is clicked', () => {
    const onChange = vi.fn();
    render(<SnappingSlider {...defaultProps} onChange={onChange} disabled />);

    const tick = screen.getByLabelText('Select 0.8mm');
    fireEvent.click(tick);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows custom unit suffix', () => {
    render(<SnappingSlider {...defaultProps} unit="px" />);
    expect(screen.getByText('1.2 px')).toBeInTheDocument();
  });

  it('shows default value marker when defaultValue is provided', () => {
    const { container } = render(<SnappingSlider {...defaultProps} defaultValue={1.2} />);
    // Default marker has title="Default"
    const marker = container.querySelector('[title="Default"]');
    expect(marker).not.toBeNull();
  });

  it('highlights active tick mark', () => {
    render(<SnappingSlider {...defaultProps} value={0.8} />);
    // Active tick text has text-accent class
    const activeLabel = screen.getByText('0.8');
    expect(activeLabel).toHaveClass('text-accent');
  });

  it('has aria-live region for description updates', () => {
    render(<SnappingSlider {...defaultProps} />);
    const description = screen.getByText('Standard');
    expect(description).toHaveAttribute('aria-live', 'polite');
  });

  describe('keyboard navigation', () => {
    it('increments value with ArrowRight', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={1.2} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      expect(onChange).toHaveBeenCalledWith(1.6);
    });

    it('decrements value with ArrowLeft', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={1.2} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowLeft' });

      expect(onChange).toHaveBeenCalledWith(0.8);
    });

    it('increments value with ArrowUp', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={0.8} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(onChange).toHaveBeenCalledWith(1.2);
    });

    it('decrements value with ArrowDown', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={0.8} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenCalledWith(0.4);
    });

    it('jumps to first value with Home', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={1.6} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'Home' });

      expect(onChange).toHaveBeenCalledWith(0.4);
    });

    it('jumps to last value with End', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={0.8} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'End' });

      expect(onChange).toHaveBeenCalledWith(2.0);
    });

    it('does not change value when at min and pressing ArrowLeft', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={0.4} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowLeft' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not change value when at max and pressing ArrowRight', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={2.0} onChange={onChange} />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard when disabled', () => {
      const onChange = vi.fn();
      render(<SnappingSlider {...defaultProps} value={1.2} onChange={onChange} disabled />);

      const input = document.querySelector('input[type="range"]') as HTMLElement;
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('snap behavior', () => {
    it('snaps to nearest value on pointer release', () => {
      const onChange = vi.fn();
      const { container } = render(<SnappingSlider {...defaultProps} onChange={onChange} />);

      const slider = container.querySelector('div[role="slider"]') as HTMLElement;
      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 100,
        width: 100,
        top: 0,
        bottom: 32,
        height: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Drag to ~5% of track (close to 0.4), release
      fireEvent.pointerDown(slider, { clientX: 5, pointerId: 1 });
      fireEvent.pointerUp(slider, { clientX: 5, pointerId: 1 });
      expect(onChange).toHaveBeenCalledWith(0.4);
    });

    it('snaps to nearest from middle positions', () => {
      const onChange = vi.fn();
      const { container } = render(<SnappingSlider {...defaultProps} onChange={onChange} />);

      const slider = container.querySelector('div[role="slider"]') as HTMLElement;
      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 100,
        width: 100,
        top: 0,
        bottom: 32,
        height: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Drag to ~30% of track (between 0.8 and 1.2, closer to 0.8)
      fireEvent.pointerDown(slider, { clientX: 30, pointerId: 1 });
      fireEvent.pointerUp(slider, { clientX: 30, pointerId: 1 });
      expect(onChange).toHaveBeenCalledWith(0.8);
    });
  });
});
