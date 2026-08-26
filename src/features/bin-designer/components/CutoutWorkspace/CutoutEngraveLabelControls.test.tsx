import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutEngraveLabelControls } from './CutoutEngraveLabelControls';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 5,
    y: 5,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'M4',
    groupId: null,
    engraveLabel: true,
    ...overrides,
  };
}

function renderControls(cutout: Cutout, onUpdate = vi.fn()) {
  render(
    <CutoutEngraveLabelControls
      cutout={cutout}
      binWidth={100}
      binDepth={100}
      disabled={false}
      onUpdate={onUpdate}
    />
  );
  return onUpdate;
}

describe('CutoutEngraveLabelControls relief depth', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      history: { past: [], future: [] },
    });
  });

  it('writes a typed depth to the design-wide text defaults', () => {
    renderControls(makeCutout());

    fireEvent.click(
      screen.getByRole('button', { name: 'binDesigner.cutoutTextDepth.engrave: 0.4 mm' })
    );
    const input = screen.getByRole('textbox', { name: 'binDesigner.cutoutTextDepth.engrave' });
    fireEvent.change(input, { target: { value: '1.2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useDesignerStore.getState().params.textDefaults.depth).toBe(1.2);
  });

  it('names the field for the active mode, so emboss reads as a height', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
      },
    });
    renderControls(makeCutout());

    expect(
      screen.getByRole('button', { name: 'binDesigner.cutoutTextDepth.emboss: 0.4 mm' })
    ).toBeInTheDocument();
  });

  it('keeps the depth field off the socket branch, which engraves nothing', () => {
    renderControls(makeCutout({ labelMode: 'socket' }));

    expect(
      screen.queryByRole('button', { name: /binDesigner\.cutoutTextDepth/ })
    ).not.toBeInTheDocument();
  });
});

describe('CutoutEngraveLabelControls exact size', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      history: { past: [], future: [] },
    });
  });

  it('writes an exact size as a per-cutout fixed style', () => {
    const onUpdate = renderControls(makeCutout());

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.textSizeAuto' }));

    expect(onUpdate).toHaveBeenCalledWith({
      textStyle: { sizeMode: 'fixed', fixedSize: expect.any(Number) as number },
    });
  });

  it('seeds manual mode at the size currently rendering, not the slider max', () => {
    const onUpdate = renderControls(makeCutout());

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.textSizeAuto' }));

    const patch = onUpdate.mock.calls[0][0] as { textStyle: { fixedSize: number } };
    // A 2-char label beside a 10mm cutout in a 100mm bin auto-fits well under
    // the 40mm slider ceiling; seeding at the ceiling was the old max-seed.
    expect(patch.textStyle.fixedSize).toBeLessThan(40);
    expect(patch.textStyle.fixedSize).toBeGreaterThan(0);
  });

  it('clears both the fixed size and any legacy ceiling on Auto', () => {
    const onUpdate = renderControls(
      makeCutout({ textStyle: { sizeMode: 'fixed', fixedSize: 12, fontSizeOverride: 8 } })
    );

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.textSizeAuto' }));

    expect(onUpdate).toHaveBeenCalledWith({ textStyle: undefined });
  });

  it('shows a legacy ceiling in the slider so old designs stay editable', () => {
    renderControls(makeCutout({ textStyle: { fontSizeOverride: 8 } }));

    expect(screen.getByRole('slider', { name: 'binDesigner.textSize' })).toHaveAttribute(
      'aria-valuenow',
      '8'
    );
  });

  it('warns with the rendered size when the bin cannot hold the request', () => {
    // A 40mm request in a 30mm bin: even the widened band cannot hold it, so
    // the label shrinks and the note names the size that actually prints.
    render(
      <CutoutEngraveLabelControls
        cutout={makeCutout({ textStyle: { sizeMode: 'fixed', fixedSize: 40 } })}
        binWidth={30}
        binDepth={30}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('binDesigner.textSizeLimited');
  });

  it('shows no limit warning while the request fits', () => {
    const onUpdate = renderControls(makeCutout({ textStyle: { sizeMode: 'fixed', fixedSize: 8 } }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
