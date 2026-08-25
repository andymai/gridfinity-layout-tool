import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShapeList } from './ShapeList';
import type { Cutout } from '@/features/bin-designer/types';

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c-1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function setup(
  cutouts: Cutout[],
  selection: string[] = [],
  groupNames: Record<string, string> = {}
) {
  const handlers = {
    onSelect: vi.fn(),
    onSetProperty: vi.fn(),
    onMoveAbove: vi.fn(),
    onReparent: vi.fn(),
    onMoveUnits: vi.fn(),
    onRenameGroup: vi.fn(),
  };
  render(
    <ShapeList
      cutouts={cutouts}
      groupNames={groupNames}
      selection={new Set(selection)}
      {...handlers}
    />
  );
  return handlers;
}

describe('ShapeList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an empty state with no shapes', () => {
    setup([]);
    expect(screen.getByText(/no shapes yet/i)).toBeInTheDocument();
  });

  it('lists shapes topmost first', () => {
    setup([
      cutout({ id: 'bottom', zIndex: 0, width: 10, depth: 10 }),
      cutout({ id: 'top', zIndex: 1, width: 30, depth: 30 }),
    ]);
    const rows = screen.getAllByTitle(/Rectangle/);
    expect(rows[0]).toHaveAttribute('title', 'Rectangle 30×30');
    expect(rows[1]).toHaveAttribute('title', 'Rectangle 10×10');
  });

  it('falls back to a derived label and prefers an explicit name', () => {
    setup([cutout({ id: 'a', name: 'Drill bit 3mm' }), cutout({ id: 'b', zIndex: 1 })]);
    expect(screen.getByTitle('Drill bit 3mm')).toBeInTheDocument();
    expect(screen.getByTitle('Rectangle 20×15')).toBeInTheDocument();
  });

  it('reports the shape count', () => {
    setup([cutout({ id: 'a' }), cutout({ id: 'b' })]);
    expect(screen.getByText('Shapes: 2')).toBeInTheDocument();
  });

  describe('selection', () => {
    it('selects a row on click', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.click(screen.getByTitle('Rectangle 20×15'));
      expect(h.onSelect).toHaveBeenCalledWith(['a'], false, []);
    });

    it('passes additive when a modifier is held', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.keyboard('{Shift>}');
      await user.click(screen.getByTitle('Rectangle 20×15'));
      await user.keyboard('{/Shift}');
      expect(h.onSelect).toHaveBeenCalledWith(['a'], true, []);
    });

    it('selects every member from a group row', async () => {
      const user = userEvent.setup();
      const h = setup([
        cutout({ id: 'a', groupId: 'g1', zIndex: 1 }),
        cutout({ id: 'b', groupId: 'g1', zIndex: 0 }),
      ]);
      await user.click(screen.getByTitle('Group of 2'));
      expect(h.onSelect).toHaveBeenCalledWith(['a', 'b'], false, []);
    });
  });

  describe('lock and hide', () => {
    it('hides a shape, and the worker drops the cut', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.click(screen.getByRole('button', { name: /hide/i }));
      expect(h.onSetProperty).toHaveBeenCalledWith(['a'], { hidden: true });
    });

    it('offers to show an already-hidden shape', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a', hidden: true })]);
      await user.click(screen.getByRole('button', { name: /show/i }));
      expect(h.onSetProperty).toHaveBeenCalledWith(['a'], { hidden: false });
    });

    it('locks a shape', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.click(screen.getByRole('button', { name: /^lock$/i }));
      expect(h.onSetProperty).toHaveBeenCalledWith(['a'], { locked: true });
    });

    it('cascades a group toggle to every member', async () => {
      const user = userEvent.setup();
      const h = setup([
        cutout({ id: 'a', groupId: 'g1', zIndex: 1 }),
        cutout({ id: 'b', groupId: 'g1', zIndex: 0 }),
      ]);
      const groupRow = screen.getByTitle('Group of 2').closest('div') as HTMLElement;
      await user.click(within(groupRow).getByRole('button', { name: /^lock$/i }));
      expect(h.onSetProperty).toHaveBeenCalledWith(['a', 'b'], { locked: true });
    });
  });

  describe('groups', () => {
    it('renders members nested under the parent', () => {
      setup([
        cutout({ id: 'a', groupId: 'g1', zIndex: 1, width: 10, depth: 10 }),
        cutout({ id: 'b', groupId: 'g1', zIndex: 0, width: 30, depth: 30 }),
      ]);
      expect(screen.getByTitle('Group of 2')).toBeInTheDocument();
      expect(screen.getByTitle('Rectangle 10×10')).toBeInTheDocument();
      expect(screen.getByTitle('Rectangle 30×30')).toBeInTheDocument();
    });

    it('collapses members away', async () => {
      const user = userEvent.setup();
      setup([
        cutout({ id: 'a', groupId: 'g1', zIndex: 1, width: 10, depth: 10 }),
        cutout({ id: 'b', groupId: 'g1', zIndex: 0, width: 30, depth: 30 }),
      ]);
      await user.click(screen.getByRole('button', { name: /collapse group/i }));
      expect(screen.queryByTitle('Rectangle 10×10')).not.toBeInTheDocument();
      expect(screen.getByTitle('Group of 2')).toBeInTheDocument();
    });
  });

  describe('rename', () => {
    it('opens an input on double click and commits on Enter', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.dblClick(screen.getByTitle('Rectangle 20×15'));
      const input = screen.getByRole('textbox', { name: /rename/i });
      await user.type(input, 'Hex key{Enter}');
      expect(h.onSetProperty).toHaveBeenCalledWith(['a'], { name: 'Hex key' });
    });

    it('clears the name back to the derived label when emptied', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a', name: 'Old' })]);
      await user.dblClick(screen.getByTitle('Old'));
      const input = screen.getByRole('textbox', { name: /rename/i });
      await user.clear(input);
      await user.keyboard('{Enter}');
      expect(h.onSetProperty).toHaveBeenCalledWith(['a'], { name: undefined });
    });

    it('abandons the edit on Escape, even with the blur a browser fires', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.dblClick(screen.getByTitle('Rectangle 20×15'));
      const input = screen.getByRole('textbox', { name: /rename/i });
      await user.type(input, 'nope');
      // Real browsers blur the focused input when Escape unmounts it, which used
      // to commit the abandoned edit. jsdom omits that blur, so fire it here or
      // this test passes while the behaviour is broken where users are.
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.blur(input);
      expect(h.onSetProperty).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('exposes the rows as a multi-select listbox', () => {
      setup([cutout({ id: 'a' })]);
      const box = screen.getByRole('listbox');
      expect(box).toHaveAttribute('aria-multiselectable');
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('marks the selected row as selected', () => {
      setup([cutout({ id: 'a' }), cutout({ id: 'b', zIndex: 1 })], ['a']);
      const selected = screen
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
    });

    it('moves the roving focus with the arrow keys', async () => {
      const user = userEvent.setup();
      setup([
        cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
        cutout({ id: 'b', zIndex: 1, width: 30, depth: 30 }),
      ]);
      const options = screen.getAllByRole('option');
      // Roving tabIndex: exactly one stop for the whole list.
      expect(options.filter((o) => o.getAttribute('tabindex') === '0')).toHaveLength(1);

      options[0].focus();
      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(options[0]).toHaveFocus();
    });

    it('jumps to the ends with Home and End', async () => {
      const user = userEvent.setup();
      setup([
        cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
        cutout({ id: 'b', zIndex: 1, width: 20, depth: 20 }),
        cutout({ id: 'c', zIndex: 2, width: 30, depth: 30 }),
      ]);
      const options = screen.getAllByRole('option');
      options[0].focus();
      await user.keyboard('{End}');
      expect(options[2]).toHaveFocus();
      await user.keyboard('{Home}');
      expect(options[0]).toHaveFocus();
    });

    it('keeps lock and hide reachable on focus, not only on hover', () => {
      // Every other panel in the app pairs the hover reveal with a focus
      // variant; without it a keyboard user focuses an invisible control.
      setup([cutout({ id: 'a' })]);
      for (const name of [/^hide/i, /^lock$/i]) {
        expect(screen.getByRole('button', { name }).className).toContain(
          'focus-visible:opacity-100'
        );
      }
    });
  });

  describe('drag', () => {
    /** Row body = reparent target; the strip above it = reorder target. */
    const zones = (title: string) => {
      const body = screen.getByTitle(title).closest('[draggable="true"]') as HTMLElement;
      const strip = body.parentElement?.firstElementChild as HTMLElement;
      return { body, strip };
    };
    const startDrag = (el: HTMLElement) =>
      fireEvent.dragStart(el, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });

    it('reorders above the row whose strip receives the drop', () => {
      const h = setup([
        cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
        cutout({ id: 'b', zIndex: 1, width: 30, depth: 30 }),
      ]);
      startDrag(zones('Rectangle 10×10').body);
      fireEvent.drop(zones('Rectangle 30×30').strip);
      expect(h.onMoveAbove).toHaveBeenCalledWith(['a'], 'b');
      expect(h.onReparent).not.toHaveBeenCalled();
    });

    it('reparents onto the row body', () => {
      const h = setup([
        cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
        cutout({ id: 'b', zIndex: 1, width: 30, depth: 30 }),
      ]);
      startDrag(zones('Rectangle 10×10').body);
      fireEvent.drop(zones('Rectangle 30×30').body);
      expect(h.onReparent).toHaveBeenCalledWith(['a'], 'b');
      expect(h.onMoveAbove).not.toHaveBeenCalled();
    });

    it('moves a shape into the group it is dropped on', () => {
      const h = setup([
        cutout({ id: 'loose', zIndex: 5, width: 10, depth: 10 }),
        cutout({ id: 'g-a', groupId: 'g1', zIndex: 1 }),
        cutout({ id: 'g-b', groupId: 'g1', zIndex: 0 }),
      ]);
      startDrag(zones('Rectangle 10×10').body);
      fireEvent.drop(zones('Group of 2').body);
      // Names the group, not one of its members: the destination is the group.
      expect(h.onMoveUnits).toHaveBeenCalledWith(['shape:loose'], 'g1');
    });

    it('refuses to nest a group inside a BOOLEAN group', () => {
      const h = setup([
        cutout({ id: 'g-a', groupId: 'g1', zIndex: 3 }),
        cutout({ id: 'g-b', groupId: 'g1', zIndex: 2 }),
        cutout({ id: 'h-a', groupId: 'g2', zIndex: 1 }),
        cutout({ id: 'h-b', groupId: 'g2', zIndex: 0 }),
      ]);
      const groups = screen.getAllByTitle('Group of 2');
      const bodyOf = (el: Element) => el.closest('[draggable="true"]') as HTMLElement;
      startDrag(bodyOf(groups[0]));
      fireEvent.drop(bodyOf(groups[1]));
      // g2's members are what its op fuses; admitting a subgroup would change
      // what it carves without touching any of its own rows.
      expect(h.onMoveUnits).not.toHaveBeenCalled();
      expect(h.onReparent).not.toHaveBeenCalled();
    });

    it('nests a group inside a CONTAINER', () => {
      const h = setup([
        // `outer` holds a loose shape, so it is a container, not a boolean group.
        cutout({ id: 'loose', parentGroups: ['outer'], zIndex: 3 }),
        cutout({ id: 'g-a', groupId: 'g1', zIndex: 1 }),
        cutout({ id: 'g-b', groupId: 'g1', zIndex: 0 }),
      ]);
      const bodyOf = (el: Element) => el.closest('[draggable="true"]') as HTMLElement;
      startDrag(bodyOf(screen.getByTitle('Group of 2')));
      fireEvent.drop(bodyOf(screen.getByTitle('Group of 1')));
      expect(h.onMoveUnits).toHaveBeenCalledWith(['group:g1'], 'outer');
    });

    it('ignores a drop onto the dragged row itself', () => {
      const h = setup([cutout({ id: 'a' })]);
      const { body } = zones('Rectangle 20×15');
      startDrag(body);
      fireEvent.drop(body);
      expect(h.onReparent).not.toHaveBeenCalled();
      expect(h.onMoveAbove).not.toHaveBeenCalled();
    });

    it('drags the whole selection when the grabbed row is part of it', () => {
      const h = setup(
        [
          cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
          cutout({ id: 'b', zIndex: 1, width: 20, depth: 20 }),
          cutout({ id: 'c', zIndex: 2, width: 30, depth: 30 }),
        ],
        ['a', 'b']
      );
      startDrag(zones('Rectangle 10×10').body);
      fireEvent.drop(zones('Rectangle 30×30').strip);
      expect(h.onMoveAbove).toHaveBeenCalledWith(expect.arrayContaining(['a', 'b']), 'c');
    });

    it('drags only the grabbed row when it is outside the selection', () => {
      const h = setup(
        [
          cutout({ id: 'a', zIndex: 0, width: 10, depth: 10 }),
          cutout({ id: 'c', zIndex: 2, width: 30, depth: 30 }),
        ],
        ['c']
      );
      startDrag(zones('Rectangle 10×10').body);
      fireEvent.drop(zones('Rectangle 30×30').strip);
      expect(h.onMoveAbove).toHaveBeenCalledWith(['a'], 'c');
    });
  });
});
