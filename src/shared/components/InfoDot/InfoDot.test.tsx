import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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
    // Synchronous pointer events on a fake clock: no real time passes, so the
    // delay and the close grace are tested exactly.
    const mouse = { pointerType: 'mouse' } as const;
    const tick = (ms: number): void =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setup(children: ReactNode = <p>Scoops explained.</p>) {
      vi.useFakeTimers();
      render(
        <InfoDot aria-label="About scoops" hoverDelayMs={400}>
          {children}
        </InfoDot>
      );
      return screen.getByRole('button', { name: 'About scoops' });
    }

    it('opens once the mouse rests on the dot, without taking focus', () => {
      const dot = setup();
      fireEvent.pointerEnter(dot, mouse);
      tick(399);
      expect(screen.queryByText('Scoops explained.')).toBeNull();
      tick(1);
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();
      expect(document.activeElement).toBe(document.body);
    });

    it('never opens for a pointer that only passes over', () => {
      const dot = setup();
      fireEvent.pointerEnter(dot, mouse);
      tick(200);
      fireEvent.pointerLeave(dot, mouse);
      tick(1000);
      expect(screen.queryByText('Scoops explained.')).toBeNull();
    });

    it('ignores touch, which opens with a tap instead', () => {
      const dot = setup();
      fireEvent.pointerEnter(dot, { pointerType: 'touch' });
      tick(1000);
      expect(screen.queryByText('Scoops explained.')).toBeNull();
    });

    it('stays open while the pointer crosses into the panel, and closes after it leaves', () => {
      const dot = setup();
      fireEvent.pointerEnter(dot, mouse);
      tick(400);
      fireEvent.pointerLeave(dot, mouse);
      tick(100);
      const panel = screen.getByRole('dialog', { name: 'About scoops' });
      fireEvent.pointerEnter(panel, mouse);
      tick(1000);
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();

      fireEvent.pointerLeave(panel, mouse);
      tick(149);
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();
      tick(1);
      expect(screen.queryByText('Scoops explained.')).toBeNull();
    });

    it('stays open once a control inside the hover-opened panel is used', () => {
      const dot = setup(<button type="button">Play</button>);
      fireEvent.pointerEnter(dot, mouse);
      tick(400);
      const panel = screen.getByRole('dialog', { name: 'About scoops' });
      fireEvent.pointerEnter(panel, mouse);
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Play' }), mouse);
      fireEvent.pointerLeave(panel, mouse);
      tick(1000);
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    });

    it('stays open after a click pins it, and hands focus back when closed', () => {
      const dot = setup();
      fireEvent.pointerEnter(dot, mouse);
      tick(400);
      fireEvent.click(dot);
      const panel = screen.getByRole('dialog', { name: 'About scoops' });
      expect(panel).toContainElement(document.activeElement as HTMLElement);

      fireEvent.pointerLeave(dot, mouse);
      tick(1000);
      expect(screen.getByText('Scoops explained.')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
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
