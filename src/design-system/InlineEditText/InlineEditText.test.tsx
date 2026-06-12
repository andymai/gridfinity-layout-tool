import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineEditText } from './InlineEditText';

const defaultProps = {
  value: 'My Layout',
  onCommit: vi.fn(),
  'aria-label': 'Rename layout',
};

describe('InlineEditText', () => {
  it('renders the value in a display button with title', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Rename layout' });
    expect(button).toHaveTextContent('My Layout');
    expect(button).toHaveAttribute('title', 'My Layout');
  });

  it('enters edit mode on click with the input focused and selected', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox', { name: 'Rename layout' });
    expect(input).toHaveValue('My Layout');
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe('My Layout'.length);
  });

  it('commits the trimmed value on Enter', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Renamed  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Renamed');
    expect(screen.getByRole('button', { name: 'Rename layout' })).toBeInTheDocument();
  });

  it('commits on blur', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('Blurred');
    expect(screen.getByRole('button', { name: 'Rename layout' })).toBeInTheDocument();
  });

  it('reverts on Escape without calling onCommit', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename layout' })).toHaveTextContent('My Layout');
  });

  it('ignores the native blur browsers fire when Escape unmounts the input', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits again after a revert when editing is re-entered', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Second try' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('Second try');
  });

  it('commits the fallback when the trimmed input is empty', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} fallback="Untitled layout" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Untitled layout');
  });

  it('reverts to the current value when empty and no fallback is provided', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename layout' })).toHaveTextContent('My Layout');
  });

  it('does not call onCommit when the value is unchanged', () => {
    const onCommit = vi.fn();
    render(<InlineEditText {...defaultProps} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('applies maxLength and placeholder to the input', () => {
    render(
      <InlineEditText {...defaultProps} onCommit={vi.fn()} maxLength={50} placeholder="Name" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxlength', '50');
    expect(input).toHaveAttribute('placeholder', 'Name');
  });

  it('enters edit mode on contextmenu when editOnContextMenu is set', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} editOnContextMenu />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Rename layout' }));
    expect(screen.getByRole('textbox', { name: 'Rename layout' })).toBeInTheDocument();
  });

  it('ignores contextmenu by default', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Rename layout' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('returns focus to the display button after commit', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Rename layout' })).toHaveFocus();
  });

  it('returns focus to the display button after revert', () => {
    render(<InlineEditText {...defaultProps} onCommit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename layout' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Rename layout' })).toHaveFocus();
  });

  it('applies displayClassName and inputClassName', () => {
    render(
      <InlineEditText
        {...defaultProps}
        onCommit={vi.fn()}
        displayClassName="max-w-[200px]"
        inputClassName="w-full"
      />
    );
    const button = screen.getByRole('button', { name: 'Rename layout' });
    expect(button).toHaveClass('max-w-[200px]');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveClass('w-full');
  });
});
