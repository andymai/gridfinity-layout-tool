import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LABEL_PLATE_ICONS } from '@/shared/constants/labelPlates';
import { LabelIconPicker } from './LabelIconPicker';

const setup = (value: Parameters<typeof LabelIconPicker>[0]['value'] = null) => {
  const onChange = vi.fn();
  render(<LabelIconPicker value={value} onChange={onChange} ownerName="compartment 1" />);
  return { onChange, user: userEvent.setup() };
};

const TRIGGER = /^Plate icon for compartment 1:/;

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: TRIGGER }));
  return screen.getByRole('dialog', { name: 'Plate icon for compartment 1' });
};

describe('LabelIconPicker', () => {
  // The trigger is icon-only — a 112px labelled button left the adjacent
  // plate-width select about 16px in the 256px landscape panel, and truncated
  // every name anyway. The value rides in the accessible name instead.
  it('reports the empty state in its accessible name', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'Plate icon for compartment 1: No icon' })
    ).toBeInTheDocument();
  });

  it('reports the current icon in its accessible name', () => {
    setup('washer');
    expect(
      screen.getByRole('button', { name: 'Plate icon for compartment 1: Washer' })
    ).toBeInTheDocument();
  });

  it('shows the chosen silhouette on the trigger', () => {
    setup('washer');
    const trigger = screen.getByRole('button', { name: TRIGGER });
    expect(trigger.querySelector('svg')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('title', 'Washer');
  });

  it('keeps the grid closed until asked', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers every catalog icon, grouped by domain', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    // One cell per icon, plus the "No icon" row — so a new id added to the
    // allowlist without path data fails here rather than rendering a blank cell.
    expect(within(dialog).getAllByRole('button')).toHaveLength(LABEL_PLATE_ICONS.length + 1);
    expect(within(dialog).getByText('Fasteners')).toBeInTheDocument();
    expect(within(dialog).getByText('Tooling')).toBeInTheDocument();
    expect(within(dialog).getByText('Kitchen')).toBeInTheDocument();
  });

  it('groups an icon under the domain its path data declares', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'spoon');
    expect(within(dialog).getByText('Kitchen')).toBeInTheDocument();
    expect(within(dialog).queryByText('Fasteners')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Teaspoon' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tablespoon' })).toBeInTheDocument();
  });

  it('reports the chosen icon and closes', async () => {
    const { onChange, user } = setup();
    const dialog = await openPicker(user);
    await user.click(within(dialog).getByRole('button', { name: 'Hex key' }));
    expect(onChange).toHaveBeenCalledWith('hexKey');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears the icon from the empty row', async () => {
    const { onChange, user } = setup('bolt');
    const dialog = await openPicker(user);
    await user.click(within(dialog).getByRole('button', { name: 'No icon' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marks the current icon as pressed', async () => {
    const { user } = setup('nut');
    const dialog = await openPicker(user);
    expect(within(dialog).getByRole('button', { name: 'Nut' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('filters by name', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'washer');
    expect(within(dialog).getByRole('button', { name: 'Washer' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Lock washer' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Hex key' })).not.toBeInTheDocument();
  });

  it('filters by id, so the ids in the docs are searchable', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'hexSocket');
    expect(within(dialog).getByRole('button', { name: 'Socket cap screw' })).toBeInTheDocument();
  });

  it('hides an empty domain group rather than leaving a bare heading', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'drill');
    expect(within(dialog).queryByText('Fasteners')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Tooling')).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'zzzz');
    expect(within(dialog).getByText('No icons match')).toBeInTheDocument();
  });

  it('drops the query when reopened', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'zzzz');
    await user.keyboard('{Escape}');
    const reopened = await openPicker(user);
    expect(within(reopened).getByRole('textbox')).toHaveValue('');
  });

  // Popover's click-outside handler excludes the anchor, so closing from the
  // trigger never reaches onClose — the reset has to happen on the click.
  it('drops the query when closed from the trigger', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.type(within(dialog).getByRole('textbox'), 'zzzz');
    await user.click(screen.getByRole('button', { name: TRIGGER }));
    const reopened = await openPicker(user);
    expect(within(reopened).getByRole('textbox')).toHaveValue('');
  });

  it('returns focus to the trigger after a selection', async () => {
    const { user } = setup();
    const dialog = await openPicker(user);
    await user.click(within(dialog).getByRole('button', { name: 'Hex key' }));
    await waitFor(() => expect(screen.getByRole('button', { name: TRIGGER })).toHaveFocus());
  });

  it('returns focus to the trigger after Escape', async () => {
    const { user } = setup();
    await openPicker(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: TRIGGER })).toHaveFocus());
  });

  it('names a single dialog, without nesting one inside the popover', async () => {
    const { user } = setup();
    await openPicker(user);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
