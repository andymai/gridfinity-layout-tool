import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from './ColorPicker';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) => {
    if (vars && Object.keys(vars).length > 0) {
      return `${key}:${Object.entries(vars)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')}`;
    }
    return key;
  },
}));

const baseProps = {
  zone: 'body' as ColorZone,
  zoneLabel: 'Body',
  color: '#3b82f6',
  defaultColor: '#d4d8dc',
  otherColors: [] as readonly string[],
  onChange: () => undefined,
};

describe('ColorPicker', () => {
  it('renders preset color buttons', () => {
    render(<ColorPicker {...baseProps} />);
    expect(screen.getByTitle('White')).toBeInTheDocument();
    expect(screen.getByTitle('Black')).toBeInTheDocument();
  });

  it('renders zone header with label and current hex', () => {
    render(<ColorPicker {...baseProps} />);
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('#3b82f6')).toBeInTheDocument();
  });

  it('calls onChange when a preset is clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker {...baseProps} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Red'));
    expect(onChange).toHaveBeenCalledWith('#ef4444');
  });

  it('marks the currently selected preset', () => {
    render(<ColorPicker {...baseProps} color="#ef4444" />);
    const redPreset = screen.getByTitle('Red');
    expect(redPreset).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders hex input with current color', () => {
    render(<ColorPicker {...baseProps} />);
    const input = screen.getByLabelText<HTMLInputElement>('binDesigner.colors.hexColor');
    expect(input.value).toBe('#3b82f6');
  });

  it('commits hex on Enter and rejects invalid hex', () => {
    const onChange = vi.fn();
    render(<ColorPicker {...baseProps} onChange={onChange} />);
    const input = screen.getByLabelText('binDesigner.colors.hexColor');

    fireEvent.change(input, { target: { value: '#abcdef' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('#abcdef');

    fireEvent.change(input, { target: { value: 'not-a-color' } });
    onChange.mockClear();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows other-zone colors and applies them on click', () => {
    const onChange = vi.fn();
    render(<ColorPicker {...baseProps} otherColors={['#22c55e', '#f97316']} onChange={onChange} />);
    const match = screen.getByTitle('#22c55e');
    fireEvent.click(match);
    expect(onChange).toHaveBeenCalledWith('#22c55e');
  });

  it('hides the used-in-design section when no other colors exist', () => {
    render(<ColorPicker {...baseProps} otherColors={[]} />);
    expect(screen.queryByText('binDesigner.colors.usedInDesign')).not.toBeInTheDocument();
  });

  it('resets to defaultColor and disables reset when already at default', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ColorPicker {...baseProps} onChange={onChange} />);
    const reset = screen.getByLabelText('binDesigner.colors.resetToDefault');
    expect(reset).not.toBeDisabled();
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith('#d4d8dc');

    rerender(<ColorPicker {...baseProps} color="#d4d8dc" onChange={onChange} />);
    expect(screen.getByLabelText('binDesigner.colors.resetToDefault')).toBeDisabled();
  });

  it('exposes a native color input that commits via onChange', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPicker {...baseProps} onChange={onChange} />);
    const nativeInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    expect(nativeInput).not.toBeNull();
    fireEvent.change(nativeInput, { target: { value: '#112233' } });
    expect(onChange).toHaveBeenCalledWith('#112233');
  });

  it('does not fire onChange when committing the same color (Enter→blur path stays idempotent)', () => {
    const onChange = vi.fn();
    render(<ColorPicker {...baseProps} onChange={onChange} />);
    const input = screen.getByLabelText('binDesigner.colors.hexColor');

    // Enter on the current color value should not trigger a state update;
    // the subsequent blur (which also runs applyHex) must stay quiet too.
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('brackets native-picker gestures with onGestureStart and onGestureEnd', () => {
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker
        {...baseProps}
        onChange={onChange}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />
    );
    const nativeInput = container.querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.focus(nativeInput);
    fireEvent.change(nativeInput, { target: { value: '#111111' } });
    fireEvent.change(nativeInput, { target: { value: '#222222' } });
    fireEvent.change(nativeInput, { target: { value: '#333333' } });
    fireEvent.blur(nativeInput);

    expect(onGestureStart).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('releases an open gesture when the picker unmounts (popover closed mid-drag)', () => {
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const { container, unmount } = render(
      <ColorPicker {...baseProps} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />
    );
    const nativeInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.focus(nativeInput);
    expect(onGestureStart).toHaveBeenCalledTimes(1);
    unmount();
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
  });
});
