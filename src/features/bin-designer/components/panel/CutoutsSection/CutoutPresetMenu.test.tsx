import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutPresetMenu } from './CutoutPresetMenu';
import { HEX_ACROSS_FLATS_PRESETS } from './cutoutShapePresets';

describe('CutoutPresetMenu', () => {
  it('renders one option per preset under the given label', () => {
    render(
      <CutoutPresetMenu presets={HEX_ACROSS_FLATS_PRESETS} label="Common sizes" onPick={vi.fn()} />
    );
    const select = screen.getByLabelText('Common sizes');
    // placeholder + one option per preset
    expect(select.querySelectorAll('option').length).toBe(HEX_ACROSS_FLATS_PRESETS.length + 1);
  });

  it('calls onPick with the chosen preset size in mm', () => {
    const onPick = vi.fn();
    render(
      <CutoutPresetMenu presets={HEX_ACROSS_FLATS_PRESETS} label="Common sizes" onPick={onPick} />
    );
    fireEvent.change(screen.getByLabelText('Common sizes'), { target: { value: 'hex-1-4' } });
    expect(onPick).toHaveBeenCalledWith(6.35);
  });
});
