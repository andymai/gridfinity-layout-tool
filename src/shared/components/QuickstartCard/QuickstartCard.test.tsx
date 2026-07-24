// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickstartCard } from './QuickstartCard';

const rows = [
  { icon: <svg />, text: 'Row one' },
  { icon: <svg />, text: 'Row two' },
];

describe('QuickstartCard', () => {
  it('renders the title and rows', () => {
    render(
      <QuickstartCard
        titleId="qs-title"
        title="Get started"
        rows={rows}
        dismissLabel="Got it"
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('dismisses via the button', () => {
    const onDismiss = vi.fn();
    render(
      <QuickstartCard
        titleId="qs-title"
        title="Get started"
        rows={rows}
        dismissLabel="Got it"
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledWith('got_it');
  });

  it('dismisses via Escape', () => {
    const onDismiss = vi.fn();
    render(
      <QuickstartCard
        titleId="qs-title"
        title="Get started"
        rows={rows}
        dismissLabel="Got it"
        onDismiss={onDismiss}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith('escape');
  });
});
