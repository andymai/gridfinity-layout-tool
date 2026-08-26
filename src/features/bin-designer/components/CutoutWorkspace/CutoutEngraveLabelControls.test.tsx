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
