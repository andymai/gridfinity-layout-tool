import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoDot } from './InfoDot';

describe('InfoDot', () => {
  it('reveals its prose only on demand', async () => {
    render(
      <InfoDot aria-label="About feet">
        <p>Feet explained.</p>
      </InfoDot>
    );
    expect(screen.queryByText('Feet explained.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'About feet' }));
    expect(screen.getByText('Feet explained.')).toBeInTheDocument();
  });

  it('takes focus to the explanation, and gives it back on Escape', async () => {
    const user = userEvent.setup();
    render(
      <InfoDot aria-label="About feet">
        <p>Feet explained.</p>
      </InfoDot>
    );
    const dot = screen.getByRole('button', { name: 'About feet' });
    await user.click(dot);
    const explanation = screen.getByRole('dialog', { name: 'About feet' });
    expect(explanation).toContainElement(document.activeElement as HTMLElement);
    expect(dot).toHaveAttribute('aria-controls', document.activeElement?.id);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(dot).toHaveFocus();
  });

  it('carries Tab on from the dot, in both directions, and closes behind it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <InfoDot aria-label="About feet">
          <p>Feet explained.</p>
        </InfoDot>
        <button type="button">After</button>
      </>
    );
    await user.click(screen.getByRole('button', { name: 'About feet' }));
    await user.tab();
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'About feet' }));
    await user.tab({ shift: true });
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });

  describe('with a hover delay', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function setup() {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <>
          <button type="button">Elsewhere</button>
          <InfoDot aria-label="About scoops" hoverDelayMs={400}>
            <p>Scoops explained.</p>
          </InfoDot>
        </>
      );
      return { user, dot: screen.getByRole('button', { name: 'About scoops' }) };
    }

    it('opens once the mouse rests on the dot, without taking focus', async () => {
      const { user, dot } = setup();
      await user.hover(dot);
      expect(screen.queryByText('Scoops explained.')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();
      expect(document.activeElement).toBe(document.body);
    });

    it('stays open while the pointer crosses into the panel, and closes after it leaves', async () => {
      const { user, dot } = setup();
      await user.hover(dot);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      await user.unhover(dot);
      await user.hover(screen.getByRole('dialog', { name: 'About scoops' }));
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();

      await user.unhover(screen.getByRole('dialog', { name: 'About scoops' }));
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('Scoops explained.')).toBeNull();
    });

    it('never opens for a pointer that only passes over', async () => {
      const { user, dot } = setup();
      await user.hover(dot);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      await user.unhover(dot);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('Scoops explained.')).toBeNull();
    });

    it('stays open after a click pins it, and hands focus back when closed', async () => {
      const { user, dot } = setup();
      await user.hover(dot);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      await user.click(dot);
      const panel = screen.getByRole('dialog', { name: 'About scoops' });
      expect(panel).toContainElement(document.activeElement as HTMLElement);

      await user.unhover(dot);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByText('Scoops explained.')).toBeNull();
      expect(dot).toHaveFocus();
    });
  });

  it('ignores hover without a hover delay', async () => {
    const user = userEvent.setup();
    render(
      <InfoDot aria-label="About feet">
        <p>Feet explained.</p>
      </InfoDot>
    );
    await user.hover(screen.getByRole('button', { name: 'About feet' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Feet explained.')).toBeNull();
  });
});
