import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { yearCard, type YearCard } from '../../utils/yearCards';
import { StoryPlayer } from './StoryPlayer';

const cards: YearCard[] = [yearCard('intro'), yearCard('drawers'), yearCard('thanks', true)];

beforeEach(() => {
  // jsdom has no 2D canvas; the fill between cards draws in the browser pass.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPlayer(overrides: Partial<Parameters<typeof StoryPlayer>[0]> = {}) {
  const props = {
    cards,
    onClose: vi.fn(),
    onReachEnd: vi.fn(),
    renderCard: (card: YearCard) => <p>card:{card.kind}</p>,
    ...overrides,
  };
  render(<StoryPlayer {...props} />);
  return props;
}

function key(name: string) {
  act(() => {
    fireEvent.keyDown(window, { key: name });
  });
}

describe('StoryPlayer', () => {
  it('starts on the first card and steps with the arrow keys', () => {
    renderPlayer();
    expect(screen.getByText('card:intro')).toBeInTheDocument();
    key('ArrowRight');
    expect(screen.getByText('card:drawers')).toBeInTheDocument();
    key('ArrowLeft');
    expect(screen.getByText('card:intro')).toBeInTheDocument();
  });

  it('labels each card by its place in the story', () => {
    renderPlayer();
    expect(screen.getByRole('region', { name: 'Card 1 of 3' })).toBeInTheDocument();
  });

  it('reports the end once, when the last card shows', () => {
    const props = renderPlayer();
    key('ArrowRight');
    expect(props.onReachEnd).not.toHaveBeenCalled();
    key('ArrowRight');
    key('ArrowRight');
    expect(screen.getByText('card:thanks')).toBeInTheDocument();
    expect(props.onReachEnd).toHaveBeenCalledTimes(1);
  });

  it('opens on a given card', () => {
    renderPlayer({ initialIndex: 2 });
    expect(screen.getByText('card:thanks')).toBeInTheDocument();
  });

  it('pauses with Space and closes with Escape', () => {
    const props = renderPlayer();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    key(' ');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    key('Escape');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the keys alone for a focused button in the card', () => {
    renderPlayer({ renderCard: () => <button type="button">Roll</button> });
    const roll = screen.getByText('Roll');
    act(() => {
      fireEvent.keyDown(roll, { key: ' ' });
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('resumes after a press that ends outside the card', () => {
    const capture = vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
    renderPlayer();
    const surface = screen.getByRole('region', { name: 'Card 1 of 3' }).parentElement;
    if (!surface) throw new Error('no surface');
    act(() => {
      fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    });
    expect(capture).toHaveBeenCalledWith(1);
    act(() => {
      fireEvent.lostPointerCapture(surface, { pointerId: 1 });
      // A stray release after capture was lost must not count as a tap.
      fireEvent.pointerUp(surface, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    });
    expect(screen.getByText('card:intro')).toBeInTheDocument();
    capture.mockRestore();
  });

  it('lands on a settled card when stepping while paused', () => {
    renderPlayer({
      renderCard: (card, position) => (
        <p>
          {card.kind}@{position.elapsed.toFixed(1)}
        </p>
      ),
    });
    key(' ');
    key('ArrowRight');
    expect(screen.getByText(`drawers@${(cards[1]?.settle ?? 0).toFixed(1)}`)).toBeInTheDocument();
    key('ArrowLeft');
    expect(screen.getByText(`intro@${(cards[0]?.settle ?? 0).toFixed(1)}`)).toBeInTheDocument();
  });

  it("fills the empty stage with the first card's colour before the card shows", () => {
    const seen: boolean[] = [];
    renderPlayer({
      renderCard: (card, _position, entering) => {
        seen.push(entering);
        return <p>card:{card.kind}</p>;
      },
    });
    expect(seen[0]).toBe(true);
    expect(document.querySelector('canvas[aria-hidden="true"]')).toHaveStyle({
      visibility: 'visible',
    });
  });

  it('cuts straight to a card it opens on, with no entrance', () => {
    const seen: boolean[] = [];
    renderPlayer({
      initialIndex: 2,
      renderCard: (card, _position, entering) => {
        seen.push(entering);
        return <p>card:{card.kind}</p>;
      },
    });
    expect(seen.every((entering) => !entering)).toBe(true);
  });

  it('announces the final words once, outside the animated card', () => {
    renderPlayer({ describeCard: (card) => `final ${card.kind}` });
    expect(screen.getByText('final intro')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('region', { name: 'Card 1 of 3' })).not.toHaveAttribute('aria-live');
    key('ArrowRight');
    expect(screen.getByText('final drawers')).toBeInTheDocument();
  });

  it('toggles pause once for a held Space', () => {
    renderPlayer();
    key(' ');
    act(() => {
      fireEvent.keyDown(window, { key: ' ', repeat: true });
      fireEvent.keyDown(window, { key: ' ', repeat: true });
    });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it("keeps the first finger's press when a second finger lands", () => {
    const capture = vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
    renderPlayer();
    const surface = screen.getByRole('region', { name: 'Card 1 of 3' }).parentElement;
    if (!surface) throw new Error('no surface');
    const at = { button: 0, clientX: 300, clientY: 10 };
    act(() => {
      fireEvent.pointerDown(surface, { ...at, pointerId: 1 });
      fireEvent.pointerDown(surface, { ...at, pointerId: 2 });
      fireEvent.pointerUp(surface, { ...at, pointerId: 2 });
    });
    expect(screen.getByText('card:intro')).toBeInTheDocument();
    act(() => {
      fireEvent.pointerUp(surface, { ...at, pointerId: 1 });
    });
    expect(screen.getByText('card:drawers')).toBeInTheDocument();
    capture.mockRestore();
  });
});
