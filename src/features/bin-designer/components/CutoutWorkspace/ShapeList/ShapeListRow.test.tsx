import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeListRow } from './ShapeListRow';
import { buildShapeList } from '@/features/bin-designer/components/panel/CutoutsSection/shapeListModel';
import type { Cutout } from '@/features/bin-designer/types';

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
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
  ...o,
});

type RowProps = ComponentProps<typeof ShapeListRow>;

function renderRow(c: Cutout, overrides: Partial<RowProps> = {}) {
  const [node] = buildShapeList([c]);
  const base: RowProps = {
    node,
    selected: false,
    partial: false,
    expanded: true,
    onToggleExpanded: vi.fn(),
    onSelect: vi.fn(),
    onToggleLock: vi.fn(),
    onToggleHidden: vi.fn(),
    onRename: vi.fn(),
    onDragStart: vi.fn(),
    onDragOverKind: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    dropHint: null,
    active: false,
  };
  // Spread in JSX rather than merging first: spreading a Partial into the
  // object literal widens every prop to `| undefined`.
  return render(<ShapeListRow {...base} {...overrides} />);
}

describe('ShapeListRow', () => {
  it('renders the derived label', () => {
    renderRow(cutout());
    expect(screen.getByTitle('Rectangle 20×15')).toBeInTheDocument();
  });

  it('marks a locked shape as pressed', () => {
    renderRow(cutout({ locked: true }));
    expect(screen.getByRole('button', { name: /unlock/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks a hidden shape as pressed', () => {
    renderRow(cutout({ hidden: true }));
    expect(screen.getByRole('button', { name: /show/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes to dataTransfer so Firefox actually starts the drag', () => {
    const onDragStart = vi.fn();
    const { container } = renderRow(cutout(), { onDragStart });
    const handle = container.querySelector('[draggable="true"]') as HTMLElement;
    const setData = vi.fn();
    fireEvent.dragStart(handle, { dataTransfer: { setData, effectAllowed: '' } });
    // Firefox refuses to begin a drag with an empty dataTransfer.
    expect(setData).toHaveBeenCalledWith('text/plain', expect.any(String));
    expect(onDragStart).toHaveBeenCalled();
  });

  it('reports the above zone when the reorder strip is hovered', () => {
    const onDragOverKind = vi.fn();
    const { container } = renderRow(cutout(), { onDragOverKind });
    const strip = container.firstElementChild?.firstElementChild as HTMLElement;
    fireEvent.dragOver(strip);
    expect(onDragOverKind).toHaveBeenCalledWith(expect.anything(), 'above');
  });

  it('reports the into zone when the row body is hovered', () => {
    const onDragOverKind = vi.fn();
    const { container } = renderRow(cutout(), { onDragOverKind });
    const body = container.querySelector('[draggable="true"]') as HTMLElement;
    fireEvent.dragOver(body);
    expect(onDragOverKind).toHaveBeenCalledWith(expect.anything(), 'into');
  });

  it('marks the reorder strip when the above hint is active', () => {
    const { container } = renderRow(cutout(), { dropHint: 'above' });
    const strip = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(strip.className).toContain('border-accent');
  });

  it('is draggable', () => {
    const { container } = renderRow(cutout());
    expect(container.querySelector('[draggable="true"]')).not.toBeNull();
  });
});
