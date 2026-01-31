import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionGroup } from './SectionGroup';

describe('SectionGroup', () => {
  it('renders children when expanded', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded>
        <div>Child content</div>
      </SectionGroup>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('hides children when collapsed via aria-hidden', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded={false}>
        <div>Child content</div>
      </SectionGroup>
    );

    const button = screen.getByText('Test Group').closest('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows summary when collapsed', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded={false} summary="Group summary text">
        <div>Child content</div>
      </SectionGroup>
    );

    expect(screen.getByText('Group summary text')).toBeInTheDocument();
  });

  it('does not show summary when expanded', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded summary="Group summary text">
        <div>Child content</div>
      </SectionGroup>
    );

    expect(screen.queryByText('Group summary text')).not.toBeInTheDocument();
  });

  it('toggles on click', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded summary="Summary">
        <div>Child content</div>
      </SectionGroup>
    );

    const button = screen.getByText('Test Group').closest('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button!);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Summary')).toBeInTheDocument();

    fireEvent.click(button!);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(
      <SectionGroup title="Test Group" defaultExpanded>
        <div>Content</div>
      </SectionGroup>
    );

    const button = screen.getByText('Test Group').closest('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls');

    const regionId = button!.getAttribute('aria-controls');
    const region = document.getElementById(regionId!);
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute('aria-label', 'Test Group');
  });
});
