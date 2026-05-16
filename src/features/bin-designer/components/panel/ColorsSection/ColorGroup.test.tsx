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
  });

  it('hides children when collapsed via header click', () => {
    render(
      <ColorGroup title="Exterior">
        <div>child</div>
      </ColorGroup>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Exterior' }));
    expect(screen.queryByText('child')).not.toBeInTheDocument();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <ColorGroup title="Exterior" visible={false}>
        <div>child</div>
      </ColorGroup>
    );
    expect(container.firstChild).toBeNull();
  });

  it('respects defaultOpen=false (children hidden on mount)', () => {
    render(
      <ColorGroup title="Exterior" defaultOpen={false}>
        <div>child</div>
      </ColorGroup>
    );
    expect(screen.queryByText('child')).not.toBeInTheDocument();
  });
});
