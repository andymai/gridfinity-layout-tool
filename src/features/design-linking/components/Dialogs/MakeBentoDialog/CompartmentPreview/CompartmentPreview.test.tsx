import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompartmentPreview } from './CompartmentPreview';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const base = {
  cols: 2,
  rows: 2,
  cells: [0, 1, 2, 3],
  widthUnits: 2,
  depthUnits: 2,
  gapCompartmentIds: [],
};

describe('CompartmentPreview', () => {
  it('draws one shape per compartment', () => {
    const { container } = render(<CompartmentPreview {...base} />);

    expect(container.querySelectorAll('rect')).toHaveLength(4);
  });

  it('sizes the viewBox to the footprint so proportions are honest', () => {
    const { container } = render(
      <CompartmentPreview
        {...base}
        cols={2}
        rows={1}
        cells={[0, 1]}
        widthUnits={6}
        depthUnits={2}
      />
    );

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 6 2');
  });

  it('exposes itself as a single labelled image rather than 4 unnamed shapes', () => {
    render(<CompartmentPreview {...base} />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('designLinking.bento.preview.alt')
    );
  });

  it('renders nothing when the grid is empty, instead of an empty box', () => {
    const { container } = render(<CompartmentPreview {...base} cols={0} rows={0} cells={[]} />);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('distinguishes gap compartments from the ones the user placed', () => {
    const { container } = render(<CompartmentPreview {...base} gapCompartmentIds={[3]} />);

    const dashed = [...container.querySelectorAll('rect')].filter((r) =>
      r.getAttribute('stroke-dasharray')
    );
    expect(dashed).toHaveLength(1);
  });

  it('names each compartment for hover and assistive tech', () => {
    const { container } = render(
      <CompartmentPreview
        {...base}
        cols={2}
        rows={1}
        cells={[0, 1]}
        gapCompartmentIds={[1]}
        compartmentTexts={['Screws', '']}
      />
    );

    const titles = [...container.querySelectorAll('title')].map((n) => n.textContent);
    expect(titles).toEqual(['Screws', 'designLinking.bento.preview.gapCompartment']);
  });

  it('falls back to an unlabelled name rather than an empty title', () => {
    const { container } = render(
      <CompartmentPreview {...base} cols={1} rows={1} cells={[0]} compartmentTexts={['']} />
    );

    expect(container.querySelector('title')?.textContent).toBe(
      'designLinking.bento.preview.unlabelled'
    );
  });
});
