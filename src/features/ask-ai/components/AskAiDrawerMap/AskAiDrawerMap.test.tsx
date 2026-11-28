import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AskAiDrawerMap } from './AskAiDrawerMap';

describe('AskAiDrawerMap', () => {
  it('draws each bin with its label, and outlines the changed ones', () => {
    render(
      <AskAiDrawerMap
        grid={{ width: 4, depth: 3 }}
        label="Desk: 4 × 3 units"
        bins={[
          { label: 'Pliers', x: 0, y: 0, width: 2, depth: 2, layer: 1, color: '#3b82f6' },
          {
            label: 'M3',
            x: 3,
            y: 0,
            width: 1,
            depth: 1,
            layer: 1,
            color: '#ef4444',
            changed: true,
          },
        ]}
      />
    );
    const map = screen.getByRole('img', { name: 'Desk: 4 × 3 units' });
    expect(map).toHaveTextContent('Pliers');
    const outlined = map.querySelectorAll('rect[stroke-dasharray]');
    expect(outlined).toHaveLength(1);
    expect(outlined[0]?.nextElementSibling).toHaveTextContent('M3');
  });
});
