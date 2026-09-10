import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CtaBurst, RotatingMessage, Sparkline } from './SupportersFlourishes';

describe('Sparkline', () => {
  it('plots one point per bucket and marks the last one', () => {
    const { container } = render(
      <Sparkline
        buckets={[
          { key: 'a', count: 1 },
          { key: 'b', count: 3 },
          { key: 'c', count: 2 },
        ]}
        color="#abc"
      />
    );
    const line = container.querySelector('polyline');
    expect(line?.getAttribute('points')?.split(' ')).toHaveLength(3);
    expect(container.querySelector('circle')).not.toBeNull();
  });
});

describe('RotatingMessage', () => {
  it('shows the first message with its attribution and nothing for an empty list', () => {
    const { container, rerender } = render(
      <RotatingMessage
        items={[{ message: 'thanks!', name: 'Sam' }]}
        reducedMotion
        attribution={(name) => `from ${name}`}
      />
    );
    expect(screen.getByText('thanks!')).toBeInTheDocument();
    expect(screen.getByText('from Sam')).toBeInTheDocument();
    rerender(<RotatingMessage items={[]} reducedMotion attribution={(n) => n} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CtaBurst', () => {
  it('finishes immediately when no 2D canvas is available', () => {
    const onDone = vi.fn();
    render(<CtaBurst origin={{ x: 0, y: 0 }} accent="#f00" seed={1} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
