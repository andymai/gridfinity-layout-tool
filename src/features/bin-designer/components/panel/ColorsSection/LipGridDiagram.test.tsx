import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { LipGridDiagram } from './LipGridDiagram';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type { LipColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({ useTranslation: () => (key: string) => key }));

function lip(corners: 1 | 2 | 4, bands: 1 | 2 | 4): LipColorConfig {
  return { corners, bands, cells: makeUniformLipCells('#d4d8dc') };
}

describe('LipGridDiagram', () => {
  it('renders corners × bands cells', () => {
    const { container } = render(
      <LipGridDiagram lip={lip(4, 2)} hovered={null} onHover={vi.fn()} />
    );
    expect(container.querySelectorAll('[data-zone]')).toHaveLength(8);
  });

  it('fires onHover with the cell zone on pointer enter', () => {
    const onHover = vi.fn();
    const { container } = render(
      <LipGridDiagram lip={lip(1, 1)} hovered={null} onHover={onHover} />
    );
    const cell = container.querySelector('[data-zone="lip:frontLeft:0"]');
    fireEvent.pointerEnter(cell!);
    expect(onHover).toHaveBeenCalledWith('lip:frontLeft:0');
  });
});
