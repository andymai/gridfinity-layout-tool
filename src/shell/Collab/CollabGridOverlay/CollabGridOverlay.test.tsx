import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabGridOverlay } from './CollabGridOverlay';

vi.mock('../CollabCursors', () => ({
  CollabCursors: () => <div data-testid="collab-cursors" />,
}));
vi.mock('../CollabGhosts', () => ({
  CollabGhosts: () => <div data-testid="collab-ghosts" />,
}));
vi.mock('../CollabSelectionRings', () => ({
  CollabSelectionRings: () => <div data-testid="collab-selection-rings" />,
}));

describe('CollabGridOverlay', () => {
  it('renders the three grid-space overlays once their chunks resolve', async () => {
    render(<CollabGridOverlay />);

    expect(await screen.findByTestId('collab-selection-rings')).toBeInTheDocument();
    expect(screen.getByTestId('collab-ghosts')).toBeInTheDocument();
    expect(screen.getByTestId('collab-cursors')).toBeInTheDocument();
  });
});
