import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Grid } from '@/features/grid-editor';
import { ShellGrid } from './ShellGrid';

type GridProps = ComponentProps<typeof Grid>;

vi.mock('@/features/grid-editor', () => ({
  Grid: ({ shouldShowDrawTutorial, renderMobileToolbar, collabOverlay }: GridProps) => (
    <div
      data-testid="grid"
      data-tutorial={String(shouldShowDrawTutorial)}
      data-has-toolbar={String(typeof renderMobileToolbar === 'function')}
      data-has-overlay={String(collabOverlay !== undefined)}
    />
  ),
}));
vi.mock('@/shell/Collab/CollabGridOverlay', () => ({
  CollabGridOverlay: () => <div data-testid="collab-grid-overlay" />,
}));

describe('ShellGrid', () => {
  it('binds both shell slots onto Grid', () => {
    render(<ShellGrid shouldShowDrawTutorial />);

    const grid = screen.getByTestId('grid');
    expect(grid.dataset.tutorial).toBe('true');
    expect(grid.dataset.hasToolbar).toBe('true');
    expect(grid.dataset.hasOverlay).toBe('true');
  });
});
