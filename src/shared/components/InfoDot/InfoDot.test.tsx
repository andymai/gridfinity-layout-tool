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

  it('takes focus to the explanation, and gives it back on Escape', async () => {
    const user = userEvent.setup();
    render(
      <InfoDot aria-label="About feet">
        <p>Feet explained.</p>
      </InfoDot>
    );
    const dot = screen.getByRole('button', { name: 'About feet' });
    await user.click(dot);
    const explanation = screen.getByRole('dialog', { name: 'About feet' });
    expect(explanation).toContainElement(document.activeElement as HTMLElement);
    expect(dot).toHaveAttribute('aria-controls', document.activeElement?.id);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(dot).toHaveFocus();
  });

  it('carries Tab on from the dot, in both directions, and closes behind it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <InfoDot aria-label="About feet">
          <p>Feet explained.</p>
        </InfoDot>
        <button type="button">After</button>
      </>
    );
    await user.click(screen.getByRole('button', { name: 'About feet' }));
    await user.tab();
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'About feet' }));
    await user.tab({ shift: true });
    expect(screen.queryByText('Feet explained.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });
});
