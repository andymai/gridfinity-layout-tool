import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorGroup } from './ColorGroup';

describe('ColorGroup', () => {
  it('renders the title and shows children when open', () => {
    render(
      <ColorGroup title="Exterior">
        <div>child</div>
      </ColorGroup>
    );
    expect(screen.getByText('Exterior')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exterior' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('reports collapsed via aria-expanded after header click', () => {
    render(
      <ColorGroup title="Exterior">
        <div>child</div>
      </ColorGroup>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Exterior' }));
    expect(screen.getByRole('button', { name: 'Exterior' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <ColorGroup title="Exterior" visible={false}>
        <div>child</div>
      </ColorGroup>
    );
    expect(container.firstChild).toBeNull();
  });

  it('respects defaultOpen=false (button reports collapsed on mount)', () => {
    render(
      <ColorGroup title="Exterior" defaultOpen={false}>
        <div>child</div>
      </ColorGroup>
    );
    expect(screen.getByRole('button', { name: 'Exterior' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('auto-opens when growthTick increments (zone added to an empty group)', () => {
    const { rerender } = render(
      <ColorGroup title="Interior" defaultOpen={false} growthTick={0}>
        <div>child</div>
      </ColorGroup>
    );
    expect(screen.getByRole('button', { name: 'Interior' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    rerender(
      <ColorGroup title="Interior" defaultOpen={false} growthTick={1}>
        <div>child</div>
      </ColorGroup>
    );
    expect(screen.getByRole('button', { name: 'Interior' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
