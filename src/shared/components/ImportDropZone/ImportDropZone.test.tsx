import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDropZone } from './ImportDropZone';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('ImportDropZone', () => {
  it('hands a dropped file over and swaps the prompt while dragging', () => {
    const onFile = vi.fn();
    render(<ImportDropZone accept=".json" prompt="Drop a layout" onFile={onFile} />);
    const zone = screen.getByText('Drop a layout').parentElement as HTMLElement;
    const file = new File(['{}'], 'a.json', { type: 'application/json' });

    fireEvent.dragOver(zone);
    expect(screen.getByText('layouts.dropFileHere')).toBeInTheDocument();
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByText('Drop a layout')).toBeInTheDocument();
  });

  it('hands a browsed file over and clears the input for a repeat pick', () => {
    const onFile = vi.fn();
    const { container } = render(<ImportDropZone accept=".json" prompt="p" onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'a.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('accept', '.json');
  });

  it('keeps the drag state while moving between the zone and its children', () => {
    render(<ImportDropZone accept=".json" prompt="Drop it" onFile={vi.fn()} />);
    const prompt = screen.getByText('Drop it');
    const zone = prompt.parentElement as HTMLElement;

    // jsdom has no DragEvent; a MouseEvent carries relatedTarget and React
    // dispatches it by name.
    const leave = (relatedTarget: Element) =>
      fireEvent(zone, new MouseEvent('dragleave', { bubbles: true, relatedTarget }));

    fireEvent.dragOver(zone);
    leave(screen.getByText('layouts.browseFiles'));
    expect(screen.getByText('layouts.dropFileHere')).toBeInTheDocument();

    leave(document.body);
    expect(screen.getByText('Drop it')).toBeInTheDocument();
  });
});
