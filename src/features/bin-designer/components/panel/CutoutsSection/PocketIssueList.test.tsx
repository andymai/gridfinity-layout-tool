import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import type { PocketIssue } from './pocketChecks';
import { PocketIssueList } from './PocketIssueList';

const cutout = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const CUTOUTS = [cutout('a'), cutout('b', { name: 'Hex key' })];
const issue = (overrides: Partial<PocketIssue>): PocketIssue => ({
  kind: 'thin',
  ids: ['a', 'b'],
  instanceIds: ['a', 'b'],
  mm: 0.84,
  ...overrides,
});

const show = (issues: PocketIssue[], onSelect = vi.fn(), onFix = vi.fn()) => {
  render(<PocketIssueList issues={issues} cutouts={CUTOUTS} onSelect={onSelect} onFix={onFix} />);
  return { onSelect, onFix };
};

describe('PocketIssueList', () => {
  it('names the shapes by their name, or what they are', () => {
    show([issue({})]);
    expect(
      screen.getByRole('button', {
        name: 'Only 0.8 mm of plastic between Rectangle 20×10 and Hex key',
      })
    ).toBeInTheDocument();
  });

  it('selects the shapes an issue names', () => {
    const { onSelect } = show([issue({})]);
    fireEvent.click(screen.getByRole('button', { name: /plastic between/ }));
    expect(onSelect).toHaveBeenCalledWith(['a', 'b']);
  });

  it('offers a fix where one exists', () => {
    const floor = issue({ kind: 'floor', ids: ['a'], mm: 0.5, fix: { cutDepth: 19.8 } });
    const { onFix } = show([floor]);
    expect(screen.getByRole('button', { name: /0\.5 mm of floor under/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave 1.2 mm' }));
    expect(onFix).toHaveBeenCalledWith(floor);
  });

  it('offers to remove the islands too thin to keep', () => {
    const onFix = vi.fn();
    const thin = issue({ kind: 'island', ids: ['a'], mm: 0.3, fix: { holes: undefined } });
    show([thin], vi.fn(), onFix);
    expect(
      screen.getByText(
        'An island in Rectangle 20×10 is only 0.3 mm across at the top once clearance and the entry edge are taken off'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove thin islands' }));
    expect(onFix).toHaveBeenCalledWith(thin);
  });

  it('words each kind, and a repeat against its own copies', () => {
    show([
      issue({ kind: 'merge' }),
      issue({ kind: 'thin', ids: ['a'] }),
      issue({ kind: 'wall', ids: ['b'], mm: -0.2 }),
      issue({ kind: 'lip', ids: ['b'], mm: 0.4 }),
    ]);
    for (const text of [
      'Rectangle 20×10 and Hex key merge once clearance and entry edges are added',
      'Only 0.8 mm of plastic between copies of Rectangle 20×10',
      'Hex key breaks through the wall once clearance and its entry edge are added',
      'Hex key reaches 0.4 mm under the stacking lip, where a tool can catch',
    ]) {
      expect(screen.getByRole('button', { name: text })).toBeInTheDocument();
    }
  });

  it('keeps a long list short, with the rest a click away', () => {
    show(Array.from({ length: 8 }, (_, i) => issue({ ids: [`x${i}`] })));
    const rows = () => screen.getAllByRole('button', { name: /plastic between/ });
    expect(rows()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(rows()).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(rows()).toHaveLength(6);
  });

  it('shows nothing when every pocket passes', () => {
    const { container } = render(
      <PocketIssueList issues={[]} cutouts={CUTOUTS} onSelect={vi.fn()} onFix={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
