import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceLaunchButton } from './WorkspaceLaunchButton';

describe('WorkspaceLaunchButton', () => {
  const renderButton = (onClick = vi.fn()) => {
    render(
      <WorkspaceLaunchButton
        illustration={<div data-testid="illustration" />}
        title="Bento Workspace"
        subtitle="Drag walls to size each compartment"
        onClick={onClick}
      />
    );
    return onClick;
  };

  it('renders the illustration, title and subtitle', () => {
    renderButton();

    expect(screen.getByTestId('illustration')).toBeInTheDocument();
    expect(screen.getByText('Bento Workspace')).toBeInTheDocument();
    expect(screen.getByText('Drag walls to size each compartment')).toBeInTheDocument();
  });

  it('calls onClick when activated', () => {
    const onClick = renderButton();

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes a single button so the card header stays separately clickable', () => {
    renderButton();

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
