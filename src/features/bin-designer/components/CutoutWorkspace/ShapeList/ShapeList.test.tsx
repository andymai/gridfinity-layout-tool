import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

function setup(cutouts: Cutout[], selection: string[] = []) {
  const handlers = {
    onSelect: vi.fn(),
    onSetProperty: vi.fn(),
    onMoveAbove: vi.fn(),
    onGroupWith: vi.fn(),
    onUngroup: vi.fn(),
  };
  render(<ShapeList cutouts={cutouts} selection={new Set(selection)} {...handlers} />);
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
    expect(screen.getByText('2 shapes')).toBeInTheDocument();
  });

  describe('selection', () => {
    it('selects a row on click', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.click(screen.getByTitle('Rectangle 20×15'));
      expect(h.onSelect).toHaveBeenCalledWith(['a'], false);
    });

    it('passes additive when a modifier is held', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.keyboard('{Shift>}');
      await user.click(screen.getByTitle('Rectangle 20×15'));
      await user.keyboard('{/Shift}');
      expect(h.onSelect).toHaveBeenCalledWith(['a'], true);
    });

    it('selects every member from a group row', async () => {
      const user = userEvent.setup();
      const h = setup([
        cutout({ id: 'a', groupId: 'g1', zIndex: 1 }),
        cutout({ id: 'b', groupId: 'g1', zIndex: 0 }),
      ]);
      await user.click(screen.getByTitle('Group of 2'));
      expect(h.onSelect).toHaveBeenCalledWith(['a', 'b'], false);
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

    it('abandons the edit on Escape', async () => {
      const user = userEvent.setup();
      const h = setup([cutout({ id: 'a' })]);
      await user.dblClick(screen.getByTitle('Rectangle 20×15'));
      await user.type(screen.getByRole('textbox', { name: /rename/i }), 'nope{Escape}');
      expect(h.onSetProperty).not.toHaveBeenCalled();
    });
  });
});
