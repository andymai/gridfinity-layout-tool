import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cutout } from '@/features/bin-designer/types';
import { GroupBreadcrumb } from './GroupBreadcrumb';

function cutout(overrides: Partial<Cutout> & { id: string }): Cutout {
  return {
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

/**
 *   outer
 *   ├─ gA  a1, a2
 *   └─ hex
 */
const cutouts: Cutout[] = [
  cutout({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }),
  cutout({ id: 'a2', groupId: 'gA', parentGroups: ['outer'] }),
  cutout({ id: 'hex', parentGroups: ['outer'] }),
];

function setup(context: readonly string[], groupNames: Record<string, string> = {}) {
  const onNavigate = vi.fn();
  render(
    <GroupBreadcrumb
      cutouts={cutouts}
      groupNames={groupNames}
      context={context}
      onNavigate={onNavigate}
    />
  );
  return onNavigate;
}

describe('GroupBreadcrumb', () => {
  it('renders nothing at the top level', () => {
    const { container } = render(
      <GroupBreadcrumb cutouts={cutouts} groupNames={{}} context={[]} onNavigate={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names each level, counting DIRECT children', () => {
    setup(['outer']);
    // `outer` holds gA and hex — two units, not the three cutouts beneath it.
    expect(screen.getByText('Group of 2')).toBeInTheDocument();
  });

  it('prefers a user-chosen name over the derived label', () => {
    setup(['outer'], { outer: 'Socket tray' });
    expect(screen.getByText('Socket tray')).toBeInTheDocument();
    expect(screen.queryByText('Group of 2')).not.toBeInTheDocument();
  });

  it('navigates to an ancestor level', async () => {
    const user = userEvent.setup();
    const onNavigate = setup(['outer', 'gA'], { outer: 'Socket tray', gA: 'Ratchet' });

    await user.click(screen.getByText('Socket tray'));
    expect(onNavigate).toHaveBeenCalledWith(['outer']);
  });

  it('navigates back to the top from the root segment', async () => {
    const user = userEvent.setup();
    const onNavigate = setup(['outer']);

    await user.click(screen.getByText('All shapes'));
    expect(onNavigate).toHaveBeenCalledWith([]);
  });

  it('marks the deepest segment as current and leaves it inert', async () => {
    const user = userEvent.setup();
    const onNavigate = setup(['outer', 'gA'], { gA: 'Ratchet' });

    const current = screen.getByText('Ratchet').closest('button');
    expect(current).toBeDisabled();
    expect(current).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByText('Ratchet'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
