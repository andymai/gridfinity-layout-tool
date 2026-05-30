// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagEditDialog } from './TagEditDialog';

function setup(overrides: Partial<Parameters<typeof TagEditDialog>[0]> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <TagEditDialog
      open
      title="Edit tags"
      initialTags={['kitchen']}
      saveLabel="Save"
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSave, onClose };
}

describe('TagEditDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <TagEditDialog
        open={false}
        title="Edit tags"
        initialTags={[]}
        saveLabel="Save"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the title and seeds the initial tags', () => {
    setup();
    expect(screen.getByText('Edit tags')).toBeInTheDocument();
    expect(screen.getByText('kitchen')).toBeInTheDocument();
  });

  it('saves the current tags and closes', () => {
    const { onSave, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(['kitchen']);
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a tag then saves the union', () => {
    const { onSave } = setup();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'screws' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(['kitchen', 'screws']);
  });
});
