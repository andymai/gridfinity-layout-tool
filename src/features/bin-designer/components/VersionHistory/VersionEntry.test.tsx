import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionEntry } from './VersionEntry';
import type { DesignVersionSummary } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeVersion(overrides: Partial<DesignVersionSummary> = {}): DesignVersionSummary {
  return {
    id: 'v1',
    designId: 'design_1' as DesignVersionSummary['designId'],
    name: '0.2 mm — tight',
    thumbnail: null,
    createdAt: new Date().toISOString(),
    origin: 'manual',
    ...overrides,
  };
}

/** Reveal the row's secondary actions, which sit behind a disclosure. */
function openActions() {
  fireEvent.click(screen.getByLabelText('community.detail.moreActions'));
}

function renderEntry(overrides: Partial<DesignVersionSummary> = {}) {
  const handlers = {
    onRestore: vi.fn(),
    onRename: vi.fn(),
    onTogglePin: vi.fn(),
    onDelete: vi.fn(),
    onBranch: vi.fn(),
  };
  render(<VersionEntry version={makeVersion(overrides)} {...handlers} />);
  return handlers;
}

describe('VersionEntry', () => {
  it('keeps restore on the row without opening the actions', () => {
    renderEntry();
    expect(screen.getByText('binDesigner.versions.restore')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.versions.delete')).toBeNull();
  });

  it('shows the version name', () => {
    renderEntry();
    expect(screen.getByText('0.2 mm — tight')).toBeInTheDocument();
  });

  it('marks a pinned version', () => {
    renderEntry({ pinned: true });
    expect(screen.getByText('binDesigner.versions.pinned')).toBeInTheDocument();
  });

  it('labels an automatic pre-restore capture', () => {
    renderEntry({ origin: 'pre-restore' });
    expect(screen.getByText('binDesigner.versions.automatic')).toBeInTheDocument();
  });

  it('does not label a manual version as automatic', () => {
    renderEntry();
    expect(screen.queryByText('binDesigner.versions.automatic')).toBeNull();
  });

  // Restore overwrites the working state, so it never fires on a single click.
  it('confirms before restoring', () => {
    const { onRestore } = renderEntry();

    fireEvent.click(screen.getByText('binDesigner.versions.restore'));
    expect(onRestore).not.toHaveBeenCalled();
    expect(screen.getByText('binDesigner.versions.restoreWarning')).toBeInTheDocument();

    // Two buttons now read "restore"; the confirming one is the last.
    const buttons = screen.getAllByText('binDesigner.versions.restore');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('abandons the restore when the confirmation is cancelled', () => {
    const { onRestore } = renderEntry();

    fireEvent.click(screen.getByText('binDesigner.versions.restore'));
    fireEvent.click(screen.getByText('binDesigner.versions.cancel'));

    expect(onRestore).not.toHaveBeenCalled();
    expect(screen.queryByText('binDesigner.versions.restoreWarning')).toBeNull();
  });

  it('renames on Enter', () => {
    const { onRename } = renderEntry();

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.rename'));
    const input = screen.getByLabelText('binDesigner.versions.rename');
    fireEvent.change(input, { target: { value: '0.3 mm — loose' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }), '0.3 mm — loose');
  });

  it('discards a rename on Escape', () => {
    const { onRename } = renderEntry();

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.rename'));
    const input = screen.getByLabelText('binDesigner.versions.rename');
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
  });

  // A blank name would render an unidentifiable row.
  it('ignores a rename to whitespace', () => {
    const { onRename } = renderEntry();

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.rename'));
    const input = screen.getByLabelText('binDesigner.versions.rename');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).not.toHaveBeenCalled();
  });

  it('offers unpin for a pinned version', () => {
    const { onTogglePin } = renderEntry({ pinned: true });

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.unpin'));

    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('branches on request', () => {
    const { onBranch } = renderEntry();
    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.branch'));
    expect(onBranch).toHaveBeenCalledTimes(1);
  });

  it('confirms before deleting', () => {
    const { onDelete } = renderEntry();

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.delete'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('binDesigner.versions.deleteWarning')).toBeInTheDocument();

    const buttons = screen.getAllByText('binDesigner.versions.delete');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('abandons the delete when cancelled', () => {
    const { onDelete } = renderEntry();

    openActions();
    fireEvent.click(screen.getByText('binDesigner.versions.delete'));
    fireEvent.click(screen.getByText('binDesigner.versions.cancel'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('binDesigner.versions.deleteWarning')).toBeNull();
  });
});
