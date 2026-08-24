import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { BentoStashShelf, type BentoStashShelfProps } from './BentoStashShelf';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeProps(overrides: Partial<BentoStashShelfProps> = {}): BentoStashShelfProps {
  return {
    stash: [],
    shelfRef: createRef<HTMLDivElement>(),
    dropActive: false,
    draggingIndex: null,
    onEntryPointerDown: vi.fn(),
    onRemoveEntry: vi.fn(),
    ...overrides,
  };
}

describe('BentoStashShelf', () => {
  it('shows the empty hint when nothing is stashed', () => {
    render(<BentoStashShelf {...makeProps()} />);

    expect(screen.getByText('binDesigner.bento.stashEmptyHint')).toBeInTheDocument();
  });

  it('swaps to the drop hint while a compartment hovers the shelf', () => {
    render(<BentoStashShelf {...makeProps({ dropActive: true })} />);

    expect(screen.getByText('binDesigner.bento.stashDropHint')).toBeInTheDocument();
  });

  it('renders one tile per entry with its label', () => {
    render(
      <BentoStashShelf
        {...makeProps({
          stash: [
            { w: 2, h: 1, label: 'screws' },
            { w: 1, h: 1 },
          ],
        })}
      />
    );

    expect(screen.getByTestId('bento-stash-entry-0')).toBeInTheDocument();
    expect(screen.getByText('screws')).toBeInTheDocument();
    // Unlabeled entries fall back to their footprint.
    expect(screen.getByText('1×1')).toBeInTheDocument();
  });

  it('renders a merged entry as its footprint, front row at the bottom', () => {
    render(
      <BentoStashShelf
        {...makeProps({ stash: [{ w: 2, h: 2, cells: [true, true, true, false] }] })}
      />
    );

    const shape = screen.getByTestId('bento-stash-shape-0');
    // Back row first in DOM order: the notch sits top-right, the L's foot below.
    expect([...shape.children].map((cell) => cell.className !== '')).toEqual([
      true,
      false,
      true,
      true,
    ]);
  });

  it('renders a rectangular entry as one block, with no per-cell grid', () => {
    render(<BentoStashShelf {...makeProps({ stash: [{ w: 2, h: 2 }] })} />);

    expect(screen.queryByTestId('bento-stash-shape-0')).not.toBeInTheDocument();
  });

  it.each([
    ['wrong length', [true, true]],
    ['empty', [false, false, false, false]],
    ['all filled', [true, true, true, true]],
    ['two islands', [true, false, false, true]],
  ])('renders a %s mask as one block, matching where it would place', (_label, cells) => {
    // placeFromStash resolves every one of these to the plain rectangle, so
    // previewing the raw cells would advertise a shape the drop never produces.
    render(<BentoStashShelf {...makeProps({ stash: [{ w: 2, h: 2, cells }] })} />);

    expect(screen.queryByTestId('bento-stash-shape-0')).not.toBeInTheDocument();
  });

  it('starts a drag from a tile', () => {
    const onEntryPointerDown = vi.fn();
    render(<BentoStashShelf {...makeProps({ stash: [{ w: 2, h: 2 }], onEntryPointerDown })} />);

    fireEvent.pointerDown(screen.getByRole('button', { name: /stashEntryLabel/ }));

    expect(onEntryPointerDown).toHaveBeenCalledWith(0, expect.anything());
  });

  it('removes an entry from its delete button', () => {
    const onRemoveEntry = vi.fn();
    render(<BentoStashShelf {...makeProps({ stash: [{ w: 1, h: 2 }], onRemoveEntry })} />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.bento.stashRemove' }));

    expect(onRemoveEntry).toHaveBeenCalledWith(0);
  });

  it('renders the dragged-out tile as a placeholder without a delete button', () => {
    render(<BentoStashShelf {...makeProps({ stash: [{ w: 1, h: 1 }], draggingIndex: 0 })} />);

    expect(
      screen.queryByRole('button', { name: 'binDesigner.bento.stashRemove' })
    ).not.toBeInTheDocument();
  });
});
