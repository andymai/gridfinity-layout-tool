import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  beforeEach(() => {
    setSettings('dark', false);
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    play.mockRestore();
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
    await userEvent.click(screen.getByRole('button', { name: 'Play clip' }));
    expect(play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play clip' })).toBeNull());
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
