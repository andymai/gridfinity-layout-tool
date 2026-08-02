// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignListEmptyState } from './DesignListEmptyState';

describe('DesignListEmptyState', () => {
  it('shows the empty-state copy', () => {
    render(<DesignListEmptyState onNewDesign={vi.fn()} />);
    expect(screen.getByText('No saved designs yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start a new design/ })).toBeInTheDocument();
  });

  it('fires onNewDesign when the start button is clicked', () => {
    const onNewDesign = vi.fn();
    render(<DesignListEmptyState onNewDesign={onNewDesign} />);
    fireEvent.click(screen.getByRole('button', { name: /Start a new design/ }));
    expect(onNewDesign).toHaveBeenCalledTimes(1);
  });
});
