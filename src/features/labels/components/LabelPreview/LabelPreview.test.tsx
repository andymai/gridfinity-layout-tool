import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { loadTestTypeMeasurer } from '@/test/testTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT, planLabel } from '../../utils/planLabel';
import { LabelPreview } from './LabelPreview';

let measurer: TypeMeasurer;

beforeAll(async () => {
  measurer = await loadTestTypeMeasurer([LABEL_NAME_FONT, LABEL_DETAIL_FONT]);
});

describe('LabelPreview', () => {
  it('shows a placeholder until the fonts load', () => {
    const { container } = render(
      <LabelPreview plan={undefined} measurer={null} ariaLabel="Preview" />
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });

  it('draws the name and the detail at four pixels per millimetre', () => {
    const plan = planLabel(
      { name: 'Hex nut', detail: '90592A085' },
      { heightMm: 12, lengthMm: 40 },
      measurer
    );
    render(<LabelPreview plan={plan} measurer={measurer} ariaLabel="Preview of Hex nut" />);

    const svg = screen.getByRole('img', { name: 'Preview of Hex nut' });
    expect(svg).toHaveAttribute('viewBox', '-20 -6 40 12');
    expect(svg).toHaveStyle({ width: '160px' });
    expect(svg.querySelectorAll('path')).toHaveLength(2);
  });
});
