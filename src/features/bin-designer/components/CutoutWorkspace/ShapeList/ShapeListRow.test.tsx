import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

function renderRow(c: Cutout, overrides: Record<string, unknown> = {}) {
  const [node] = buildShapeList([c]);
  const props = {
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
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    dropHint: null,
    ...overrides,
  };
  return render(<ShapeListRow {...(props as never)} />);
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

  it('is draggable', () => {
    const { container } = renderRow(cutout());
    expect(container.querySelector('[draggable="true"]')).not.toBeNull();
  });
});
