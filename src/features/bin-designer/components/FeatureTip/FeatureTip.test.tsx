import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettingsStore } from '@/core/store';
import { FeatureTip } from './FeatureTip';

function setSettings(theme: 'light' | 'dark', reduceMotion: boolean): void {
  useSettingsStore.setState((s) => ({ settings: { ...s.settings, theme, reduceMotion } }));
}

function video(): HTMLVideoElement {
  const el = document.querySelector('video');
  if (!el) throw new Error('no video');
  return el;
}

describe('FeatureTip', () => {
  let play: ReturnType<typeof vi.spyOn>;
  let pause: MockInstance<HTMLMediaElement['pause']> | undefined;

  beforeEach(() => {
    setSettings('dark', false);
    // jsdom does not play media; fire the event a browser fires so the card
    // follows the element's real state.
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement
    ) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
  });

  afterEach(() => {
    play.mockRestore();
    pause?.mockRestore();
    pause = undefined;
  });

  it('opens a card with the clip for the current theme, its caption and detail', async () => {
    setSettings('light', false);
    render(<FeatureTip tip="lids" feature="Lid" detail="Print it upside down." />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Lid works' }));

    expect(video().getAttribute('src')).toContain('lids.light.mp4');
    expect(video().getAttribute('poster')).toContain('lids.light.webp');
    expect(screen.getByText(/presses on, slides in or swings open/)).toBeInTheDocument();
    expect(screen.getByText('Print it upside down.')).toBeInTheDocument();
  });

  it('starts the clip muted and looping', async () => {
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));

    expect(play).toHaveBeenCalledTimes(1);
    expect(video().muted).toBe(true);
    expect(video().loop).toBe(true);
    expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull();
  });

  it('holds the poster behind a play button while Reduce motion is on', async () => {
    setSettings('dark', true);
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));

    expect(play).not.toHaveBeenCalled();
    expect(video().getAttribute('poster')).toContain('scoops.dark.webp');
    await userEvent.click(screen.getByRole('button', { name: 'Play clip' }));
    expect(play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull());
  });

  it('keeps keyboard focus in the card when Play is pressed', async () => {
    setSettings('dark', true);
    const user = userEvent.setup();
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await user.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));
    screen.getByRole('button', { name: 'Play clip' }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull());
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('stops the loop when Reduce motion is turned on while the card is open', async () => {
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement
    ) {
      this.dispatchEvent(new Event('pause'));
    });
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));
    expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull();

    act(() => setSettings('dark', true));
    expect(pause).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Play clip' })).toBeInTheDocument();
  });

  it('offers Play again when a theme change swaps the clip under Reduce motion', async () => {
    setSettings('dark', true);
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play clip' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull());

    act(() => setSettings('light', true));
    // jsdom does not run the load algorithm; a browser fires this on the new src.
    act(() => {
      video().dispatchEvent(new Event('emptied'));
    });
    expect(video().getAttribute('src')).toContain('scoops.light.mp4');
    expect(screen.getByRole('button', { name: 'Play clip' })).toBeInTheDocument();
  });

  it('keeps the play button when a manual play is refused', async () => {
    setSettings('dark', true);
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play clip' }));

    expect(screen.getByRole('button', { name: 'Play clip' })).toBeInTheDocument();
  });

  it('offers the play button when the browser refuses to autoplay', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    render(<FeatureTip tip="scoops" feature="Finger scoop" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Finger scoop works' }));

    expect(await screen.findByRole('button', { name: 'Play clip' })).toBeInTheDocument();
  });

  it('marks the lid type the clip is showing', async () => {
    render(<FeatureTip tip="lids" feature="Lid" />);
    await userEvent.click(screen.getByRole('button', { name: 'See how Lid works' }));
    Object.defineProperty(video(), 'currentTime', { value: 2.5, configurable: true });

    await waitFor(() =>
      expect(screen.getByText('Sliding')).toHaveAttribute('aria-current', 'true')
    );
    expect(screen.getByText('Friction')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Hinged')).not.toHaveAttribute('aria-current');
  });
});
