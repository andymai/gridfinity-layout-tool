import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardFrame } from './CardFrame';
import { useFrameSize } from './frameSize';

function Size() {
  const size = useFrameSize();
  return <p>scale:{size.scale > 0 ? 'set' : 'none'}</p>;
}

describe('CardFrame', () => {
  it('lays the card out at 1080 × 1920 in the card colour, the overlay over it', () => {
    render(
      <CardFrame background="#2EE6A8" overlay={<div>overlay</div>}>
        <p>card</p>
      </CardFrame>
    );
    const card = screen.getByText('card').parentElement;
    expect(card).toHaveStyle({ width: '1080px', height: '1920px' });
    expect(card?.parentElement).toHaveStyle({ background: '#2EE6A8' });
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });

  it('gives its children a scale even before the first measure', () => {
    render(
      <CardFrame background="#000000">
        <Size />
      </CardFrame>
    );
    expect(screen.getByText('scale:set')).toBeInTheDocument();
  });
});
