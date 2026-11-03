import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NO_CLEANUP, type CleanupSettings } from '@/shared/outlineCleanup';
import { OutlineCleanupControls } from './OutlineCleanupControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const onChange = vi.fn();
const onReset = vi.fn();

function renderControls(
  overrides: Partial<{
    settings: CleanupSettings;
    yDown: boolean;
    upright: boolean;
    canMirror: boolean;
  }> = {}
) {
  return render(
    <OutlineCleanupControls
      settings={NO_CLEANUP}
      onChange={onChange}
      onReset={onReset}
      yDown={false}
      upright
      squareTo="bin"
      {...overrides}
    />
  );
}

const MIRRORED: CleanupSettings = { ...NO_CLEANUP, mirror: { axis: 'horizontal', keep: 'low' } };

describe('OutlineCleanupControls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('holds a slider step open, then finishes it', () => {
    renderControls();
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'binDesigner.cutouts.outline.simplify' }),
      {
        key: 'ArrowRight',
      }
    );
    expect(onChange).toHaveBeenNthCalledWith(1, { ...NO_CLEANUP, simplify: 0.05 }, false);
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_CLEANUP, simplify: 0.05 }, true);
  });

  it('turns curves and straightening on as finished changes', () => {
    renderControls();
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.curves' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_CLEANUP, curves: true }, true);
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.straighten' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_CLEANUP, straighten: true }, true);
  });

  it('starts a mirror at the detected line, averaging both halves', () => {
    renderControls();
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.mirror' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { ...NO_CLEANUP, mirror: { axis: 'detected', keep: 'average' } },
      true
    );
  });

  it('names the halves as they read on screen', () => {
    const { unmount } = renderControls({ settings: MIRRORED, upright: true });
    expect(screen.getByText('binDesigner.cutouts.outline.keep.left')).toBeInTheDocument();
    unmount();

    // Level, with y running up the screen: the low side is the bottom.
    const level = renderControls({ settings: MIRRORED, upright: false });
    const labels = screen.getAllByRole('radio').map((r) => r.textContent);
    expect(labels).toContain('binDesigner.cutouts.outline.keep.bottom');
    expect(labels.indexOf('binDesigner.cutouts.outline.keep.bottom')).toBeLessThan(
      labels.indexOf('binDesigner.cutouts.outline.keep.top')
    );
    level.unmount();

    renderControls({ settings: MIRRORED, upright: false, yDown: true });
    const down = screen.getAllByRole('radio').map((r) => r.textContent);
    expect(down.indexOf('binDesigner.cutouts.outline.keep.top')).toBeLessThan(
      down.indexOf('binDesigner.cutouts.outline.keep.bottom')
    );
  });

  it('leaves mirroring out where it cannot apply', () => {
    renderControls({ canMirror: false });
    expect(screen.queryByText('binDesigner.cutouts.outline.mirror')).toBeNull();
  });

  it('offers a reset only once something changed', () => {
    const { unmount } = renderControls();
    expect(screen.queryByText('binDesigner.cutouts.outline.reset')).toBeNull();
    unmount();
    renderControls({ settings: { ...NO_CLEANUP, curves: true } });
    fireEvent.click(screen.getByText('binDesigner.cutouts.outline.reset'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
