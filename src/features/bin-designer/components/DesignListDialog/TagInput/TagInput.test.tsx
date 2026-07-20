// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagInput } from './TagInput';
import { useTagAppearanceStore } from '@/features/bin-designer/store/tagAppearance';

beforeEach(() => {
  useTagAppearanceStore.setState({ appearances: {} });
});

describe('TagInput', () => {
  it('commits a tag on Enter and clears the draft', () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'kitchen' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['kitchen']);
  });

  it('does not add a duplicate (case-insensitive)', () => {
    const onChange = vi.fn();
    render(<TagInput value={['Kitchen']} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'kitchen' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a tag via its remove button', () => {
    const onChange = vi.fn();
    render(<TagInput value={['kitchen', 'screws']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/kitchen/i));
    expect(onChange).toHaveBeenCalledWith(['screws']);
  });

  it('Backspace on an empty draft drops the last tag', () => {
    const onChange = vi.fn();
    render(<TagInput value={['kitchen', 'screws']} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['kitchen']);
  });

  it('adds an existing tag when its suggestion is clicked', () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} suggestions={['kitchen', 'screws']} />);
    fireEvent.click(screen.getByRole('button', { name: /add tag kitchen/i }));
    expect(onChange).toHaveBeenCalledWith(['kitchen']);
  });

  it('hides suggestions that are already applied (case-insensitive)', () => {
    render(<TagInput value={['Kitchen']} onChange={vi.fn()} suggestions={['kitchen', 'screws']} />);
    expect(screen.queryByRole('button', { name: /add tag kitchen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add tag screws/i })).toBeInTheDocument();
  });

  it('filters suggestions by the draft text', () => {
    render(<TagInput value={[]} onChange={vi.fn()} suggestions={['kitchen', 'screws']} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'scr' } });
    expect(screen.queryByRole('button', { name: /add tag kitchen/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add tag screws/i })).toBeInTheDocument();
  });

  it('renders no suggestion section without suggestions', () => {
    render(<TagInput value={[]} onChange={vi.fn()} />);
    expect(screen.queryByText(/existing tags/i)).not.toBeInTheDocument();
  });

  it('shows tag icons on applied chips and suggestions', () => {
    useTagAppearanceStore.setState({
      appearances: { kitchen: { icon: '🔧' }, screws: { icon: '✂️' } },
    });
    render(<TagInput value={['kitchen']} onChange={vi.fn()} suggestions={['screws']} />);
    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.getByText('✂️')).toBeInTheDocument();
  });
});
