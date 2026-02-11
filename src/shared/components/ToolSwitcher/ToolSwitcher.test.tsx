import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolSwitcher } from './ToolSwitcher';

const mockNavigateToDesigner = vi.fn();
const mockNavigateToPlanner = vi.fn();
let mockIsDesignerRoute = false;

vi.mock('@/hooks/useDesignerRouting', () => ({
  useDesignerRouting: () => ({
    isDesignerRoute: mockIsDesignerRoute,
    navigateToDesigner: mockNavigateToDesigner,
    navigateToPlanner: mockNavigateToPlanner,
  }),
}));

describe('ToolSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesignerRoute = false;
  });

  it('shows tablist', () => {
    render(<ToolSwitcher />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('has planner tab selected by default', () => {
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('has designer tab selected when on designer route', () => {
    mockIsDesignerRoute = true;
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates to designer when clicking designer tab', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[1]); // Click designer tab

    expect(mockNavigateToDesigner).toHaveBeenCalledTimes(1);
  });

  it('navigates to planner when clicking planner tab', async () => {
    const user = userEvent.setup();
    mockIsDesignerRoute = true;
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]); // Click planner tab

    expect(mockNavigateToPlanner).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when clicking already active tab', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]); // Click already active planner tab

    expect(mockNavigateToPlanner).not.toHaveBeenCalled();
    expect(mockNavigateToDesigner).not.toHaveBeenCalled();
  });

  it('renders GridfinityIcon', () => {
    render(<ToolSwitcher />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies compact styles when compact prop is true', () => {
    render(<ToolSwitcher compact />);
    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveClass('gap-1.5');
  });

  it('applies regular styles when compact prop is false', () => {
    render(<ToolSwitcher />);
    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveClass('gap-2');
  });

  it('has accessible labels', () => {
    render(<ToolSwitcher />);
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Tool Switcher');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Active tool');
  });

  it('shows title attribute on inactive tabs', () => {
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).not.toHaveAttribute('title'); // Active tab
    // Title includes keyboard shortcut
    const title = tabs[1].getAttribute('title');
    expect(title).toContain('Switch to Bin Designer');
  });

  it('shows correct title attribute when designer is active', () => {
    mockIsDesignerRoute = true;
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    // Title includes keyboard shortcut
    const title = tabs[0].getAttribute('title');
    expect(title).toContain('Switch to');
    expect(tabs[1]).not.toHaveAttribute('title'); // Active tab
  });
});
