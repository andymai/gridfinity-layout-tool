import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidePanel } from './SidePanel';

const labels = { collapse: 'Collapse panel', expand: 'Expand panel', resize: 'Resize panel' };

function renderPanel(props: Partial<Parameters<typeof SidePanel.Root>[0]> = {}) {
  return render(
    <SidePanel.Root labels={labels} railTitle="Inspector" {...props}>
      <SidePanel.Header>
        <span>Title</span>
      </SidePanel.Header>
      <SidePanel.Body>
        <div style={{ height: 2000 }}>Content</div>
      </SidePanel.Body>
    </SidePanel.Root>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('SidePanel', () => {
  it('renders header and body content', () => {
    renderPanel();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('collapses to a rail and expands back', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('notifies on collapse state changes', () => {
    const onCollapsedChange = vi.fn();
    renderPanel({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('persists collapsed state under the persistKey', () => {
    renderPanel({ persistKey: 'test-panel' });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
    expect(localStorage.getItem('test-panel-collapsed')).toBe('1');
  });

  it('restores a persisted width', () => {
    localStorage.setItem('test-panel-width', '300');
    renderPanel({ persistKey: 'test-panel' });
    const separator = screen.getByRole('separator', { name: 'Resize panel' });
    expect(separator).toHaveAttribute('aria-valuenow', '300');
  });

  it('rejects a persisted width outside the bounds', () => {
    localStorage.setItem('test-panel-width', '9999');
    renderPanel({ persistKey: 'test-panel', defaultWidth: 288 });
    expect(screen.getByRole('separator', { name: 'Resize panel' })).toHaveAttribute(
      'aria-valuenow',
      '288'
    );
  });

  it('exposes a keyboard-operable resize handle', () => {
    renderPanel({ persistKey: 'test-panel', minWidth: 220, maxWidth: 420, defaultWidth: 288 });
    const separator = screen.getByRole('separator', { name: 'Resize panel' });
    expect(separator).toHaveAttribute('aria-valuemin', '220');
    expect(separator).toHaveAttribute('aria-valuemax', '420');

    // Right-docked panel: ArrowLeft moves the handle left, growing the panel.
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(separator).toHaveAttribute('aria-valuenow', '304');
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '288');
    fireEvent.keyDown(separator, { key: 'End' });
    expect(separator).toHaveAttribute('aria-valuenow', '420');
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(separator).toHaveAttribute('aria-valuenow', '220');
    expect(localStorage.getItem('test-panel-width')).toBe('220');
  });

  it('inverts arrow direction for a left-docked panel', () => {
    renderPanel({ side: 'left', defaultWidth: 288 });
    const separator = screen.getByRole('separator', { name: 'Resize panel' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '304');
  });

  it('marks the header once the body scrolls', () => {
    const { container } = renderPanel();
    const body = screen.getByText('Content').parentElement as HTMLElement;
    Object.defineProperty(body, 'scrollTop', { value: 50, configurable: true });
    fireEvent.scroll(body);
    const header = container.querySelector('.shadow-elevated');
    expect(header).not.toBeNull();
  });
});
