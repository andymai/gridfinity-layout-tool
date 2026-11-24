import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet } from '@/shared/toolSets/generateToolSet';
import { ToolSetPreview } from './ToolSetPreview';

describe('ToolSetPreview', () => {
  it('draws a pocket and a size for each wrench, and the channel', () => {
    let n = 0;
    const set = generateToolSet(
      {
        family: 'combinationWrench',
        units: 'metric',
        sizes: ['10', '13'],
        style: 'flat',
        clearanceMm: 0.4,
        labelSizeMm: 5,
        fingerChannel: true,
      },
      TOOL_FAMILIES.combinationWrench,
      { setId: 's', idFor: () => `c${n++}`, names: { pocket: (s) => s, channel: '' } }
    );
    if (!set) throw new Error('expected a set');
    render(<ToolSetPreview set={set} />);
    const svg = screen.getByTestId('tool-set-preview');
    expect(svg.querySelectorAll('polygon')).toHaveLength(2);
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    expect(svg.textContent).toContain('10');
    expect(svg.textContent).toContain('13');
  });
});
