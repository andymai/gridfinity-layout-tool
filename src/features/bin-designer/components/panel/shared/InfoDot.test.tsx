import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoDot } from './InfoDot';

describe('InfoDot', () => {
  it('reveals its prose only on demand', async () => {
    render(
      <InfoDot aria-label="About feet">
        <p>Feet explained.</p>
      </InfoDot>
    );
    expect(screen.queryByText('Feet explained.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'About feet' }));
    expect(screen.getByText('Feet explained.')).toBeInTheDocument();
  });
});
